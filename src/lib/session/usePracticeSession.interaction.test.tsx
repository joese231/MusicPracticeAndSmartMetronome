// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePracticeSession } from "./usePracticeSession";
import { buildSimpleMetronomeBlock } from "./blocks";
import type { TempoSubject } from "./runtimeTypes";

vi.mock("@/lib/metronome/scheduler", () => ({
  Metronome: class {
    start = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn(); resume = vi.fn(); stop = vi.fn(); dispose = vi.fn();
    setVolume = vi.fn(); setAccentsEnabled = vi.fn(); setMode = vi.fn();
    setBpm = vi.fn(); alignToDownbeat = vi.fn(); playTransitionCue = vi.fn();
    getDiagnostics = vi.fn(() => ({ ctxState: "running", running: true }));
  },
}));
afterEach(() => { cleanup(); vi.useRealTimers(); });

function setup(autoAdvanceBlocks = false) {
  const onComplete = vi.fn();
  const onSessionStarted = vi.fn();
  const onFinalAdvance = vi.fn();
  const subject: TempoSubject = { workingBpm: 80, warmupBpm: null, troubleSpots: [], originalBpm: null, stepPercent: 2.5 };
  const blocks = [buildSimpleMetronomeBlock(30), buildSimpleMetronomeBlock(30)];
  const runtimeSubjectRef = { current: subject };
  const result = renderHook(({ silent, editor }: { silent: boolean; editor: boolean }) => usePracticeSession({
    blocks, runtimeSubjectRef,
    settings: { recordingEnabled: false, metronomeVolume: 0.8, accentsEnabled: true, autoAdvanceBlocks },
    metronomeMode: "all", clearLatestRecording: vi.fn(), getStartSubject: () => subject,
    onComplete, onFinalAdvance, onAbort: vi.fn(), onSessionStarted, createMetronomeWhenSilent: true,
    metronomeSuppressed: silent, editorOpen: editor,
  }), { initialProps: { silent: false, editor: false } });
  return { ...result, onComplete, onSessionStarted, onFinalAdvance };
}

describe("live session controls", () => {
  it("finishes the final playing timed block with Space instead of opening review", async () => {
    const { result, onFinalAdvance, onComplete } = setup();
    await act(async () => { await result.current.startSession(); });
    act(() => result.current.setSnap({ blockIndex: 1, phase: "playing", blockStartMs: Date.now() }));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(onFinalAdvance).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("moves directly to the next playing timed block with Space", async () => {
    const { result, onFinalAdvance } = setup();
    await act(async () => { await result.current.startSession(); });
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(result.current.snap).toMatchObject({ blockIndex: 1, phase: "playing" });
    expect(onFinalAdvance).not.toHaveBeenCalled();
  });

  it("does not advance or finish with Space while paused", async () => {
    const { result, onFinalAdvance } = setup();
    await act(async () => { await result.current.startSession(); });
    act(() => result.current.setSnap({ blockIndex: 1, phase: "playing", blockStartMs: Date.now() }));
    act(() => result.current.handlePauseToggle());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(result.current.snap).toMatchObject({ blockIndex: 1, phase: "playing" });
    expect(onFinalAdvance).not.toHaveBeenCalled();
  });

  it("does not finish a final playing block with Space while the editor is open", async () => {
    const { result, rerender, onFinalAdvance } = setup();
    await act(async () => { await result.current.startSession(); });
    act(() => result.current.setSnap({ blockIndex: 1, phase: "playing", blockStartMs: Date.now() }));
    rerender({ silent: false, editor: true });
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(result.current.snap).toMatchObject({ blockIndex: 1, phase: "playing" });
    expect(onFinalAdvance).not.toHaveBeenCalled();
  });
  it("finishes the final waiting block with the Space shortcut", async () => {
    const { result, onFinalAdvance } = setup();
    await act(async () => { await result.current.startSession(); });
    act(() => result.current.setSnap({ blockIndex: 1, phase: "awaiting", blockStartMs: Date.now() }));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(onFinalAdvance).toHaveBeenCalledTimes(1);
  });
  it("finishes the final ended review with the Space shortcut", async () => {
    const { result, onFinalAdvance } = setup();
    await act(async () => { await result.current.startSession(); });
    act(() => result.current.setSnap({ blockIndex: 1, phase: "ended", blockStartMs: Date.now() }));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(onFinalAdvance).toHaveBeenCalledTimes(1);
  });
  it("leaves the final timer available for BPM changes and repeat despite auto advance", async () => {
    vi.useFakeTimers();
    const { result, onComplete } = setup(true);
    await act(async () => { await result.current.startSession(); });
    act(() => result.current.setSnap({ blockIndex: 1, phase: "awaiting", blockStartMs: Date.now() }));
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.snap?.phase).toBe("awaiting");
    expect(onComplete).not.toHaveBeenCalled();
    act(() => result.current.handleRepeatBlock());
    expect(result.current.snap).toMatchObject({ blockIndex: 1, phase: "playing" });
  });

  it("finalizes once, then restarts from the first block with a new start time", async () => {
    vi.useFakeTimers();
    const { result, onSessionStarted } = setup();
    await act(async () => { await result.current.startSession(); });
    const firstStart = result.current.sessionStartIsoRef.current;
    const save = vi.fn();
    await act(async () => {
      await result.current.finishSession("complete", save);
      await result.current.finishSession("complete", save);
    });
    expect(save).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1000); result.current.prepareRestart(); });
    await act(async () => { await result.current.startSession(); });
    expect(result.current.snap).toMatchObject({ blockIndex: 0, phase: "playing" });
    expect(result.current.sessionStartIsoRef.current).not.toBe(firstStart);
    expect(onSessionStarted).toHaveBeenCalledTimes(2);
  });

  it("keeps the saved silent preference across block transitions and ignores shortcuts in the editor", async () => {
    const { result, rerender } = setup();
    await act(async () => { await result.current.startSession(); });
    const m = result.current.metronomeRef.current!;
    vi.mocked(m.resume).mockClear();
    rerender({ silent: true, editor: true });
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(result.current.snap?.blockIndex).toBe(0);
    rerender({ silent: true, editor: false });
    act(() => result.current.advance());
    expect(result.current.snap?.blockIndex).toBe(1);
    expect(m.resume).not.toHaveBeenCalled();
    expect(m.pause).toHaveBeenCalled();
  });
});
