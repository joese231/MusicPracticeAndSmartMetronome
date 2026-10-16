// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePracticeSession } from "./usePracticeSession";
import { buildSimpleMetronomeBlock } from "./blocks";
import type { TempoSubject } from "./runtimeTypes";

const recorderMock = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/audio/recorder", () => ({ SessionRecorder: class {
  start = recorderMock.start;
  cancel = recorderMock.cancel;
} }));
vi.mock("@/lib/metronome/scheduler", () => ({ Metronome: class {
  start = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn(); resume = vi.fn(); stop = vi.fn(); dispose = vi.fn();
  setVolume = vi.fn(); setAccentsEnabled = vi.fn(); setMode = vi.fn();
  setBpm = vi.fn(); alignToDownbeat = vi.fn(); playTransitionCue = vi.fn();
  getDiagnostics = vi.fn(() => ({ ctxState: "running", running: true }));
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  recorderMock.start.mockImplementation(() => new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
  const subject: TempoSubject = { workingBpm: 80, warmupBpm: null, troubleSpots: [], originalBpm: null, stepPercent: 2.5 };
  const blocks = [buildSimpleMetronomeBlock(30)];
  const runtimeSubjectRef = { current: subject };
  const onRecordingError = vi.fn();
  const onSessionStarted = vi.fn();
  const hook = renderHook(() => usePracticeSession({
    blocks, runtimeSubjectRef,
    settings: { recordingEnabled: true, metronomeVolume: 0.8, accentsEnabled: true, autoAdvanceBlocks: false },
    metronomeMode: "all", clearLatestRecording: vi.fn(), getStartSubject: () => subject,
    onComplete: vi.fn(), onAbort: vi.fn(), onSessionStarted, onRecordingError,
  }));
  return { ...hook, resolve: () => resolve(), reject: () => reject(new Error("Denied")), onRecordingError, onSessionStarted };
}

describe("session start during microphone permission", () => {
  it("shows the running timer before microphone permission resolves", async () => {
    const { result, resolve, onSessionStarted } = setup();
    act(() => { void result.current.startSession(); });
    expect(result.current.started).toBe(true);
    expect(result.current.snap).toMatchObject({ phase: "playing", blockIndex: 0 });
    expect(onSessionStarted).toHaveBeenCalledTimes(1);
    expect(result.current.recordingActive).toBe(false);
    await act(async () => resolve());
    expect(result.current.recordingActive).toBe(true);
  });

  it("ignores a repeated start before React renders the running timer", () => {
    const { result, onSessionStarted } = setup();
    act(() => {
      void result.current.startSession();
      void result.current.startSession();
    });
    expect(onSessionStarted).toHaveBeenCalledTimes(1);
    expect(recorderMock.start).toHaveBeenCalledTimes(1);
  });

  it("cancels a recording granted after the session ends", async () => {
    const { result, resolve } = setup();
    act(() => { void result.current.startSession(); });
    const save = vi.fn();
    await act(async () => result.current.finishSession("abort", save));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ recorder: null }));
    await act(async () => resolve());
    expect(recorderMock.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.recordingActive).toBe(false);
    expect(result.current.recorderRef.current).toBeNull();
  });

  it("cancels a late microphone grant after unmount", async () => {
    const { result, unmount, resolve } = setup();
    act(() => { void result.current.startSession(); });
    unmount();
    await act(async () => resolve());
    expect(recorderMock.cancel).toHaveBeenCalledTimes(1);
  });

  it("keeps practice running when microphone permission is denied", async () => {
    const { result, reject, onRecordingError } = setup();
    act(() => { void result.current.startSession(); });
    await act(async () => reject());
    expect(result.current.started).toBe(true);
    expect(result.current.recordingActive).toBe(false);
    expect(onRecordingError).toHaveBeenCalledTimes(1);
  });
});
