// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/song";
import ExerciseSessionPage from "@/app/exercise-session/[id]/page";
import SongSessionPage from "@/app/session/[id]/page";

const state = vi.hoisted(() => ({
  id: "current", push: vi.fn(), complete: vi.fn(), load: vi.fn(), update: vi.fn(),
  exercises: [] as unknown[], songs: [] as unknown[], settings: {} as unknown,
}));
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: state.id }), useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: state.push }),
}));
vi.mock("@/lib/store/useExercisesStore", () => ({ useExercisesStore: (select: (store: unknown) => unknown) => select({ exercises: state.exercises, loaded: true, load: state.load, updateExercise: state.update }) }));
vi.mock("@/lib/store/useSongsStore", () => ({ useSongsStore: (select: (store: unknown) => unknown) => select({ songs: state.songs, loaded: true, load: state.load, updateSong: state.update }) }));
vi.mock("@/lib/store/useSettingsStore", () => ({ useSettingsStore: (select: (store: unknown) => unknown) => select({ settings: state.settings, loaded: true, load: state.load }) }));
vi.mock("@/lib/store/useSessionHistoryStore", () => ({
  genSessionRecordId: () => "test-session", useSessionHistoryStore: (select: (store: unknown) => unknown) => select({ complete: state.complete }),
}));
vi.mock("@/lib/store/useSessionStore", () => ({ useSessionStore: (select: (store: unknown) => unknown) => select({ clearLatestRecording: () => {}, setLatestRecording: () => {} }) }));

const common = { id: "current", workingBpm: 80, warmupBpm: null, notes: null, link: null, practiceMode: "simple", includeWarmupBlock: false, metronomeEnabled: false, stepPercent: 2.5, totalPracticeSec: 0, sortIndex: 0, createdAt: "2026-10-16T00:00:00.000Z", updatedAt: "2026-10-16T00:00:00.000Z" };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));
  state.settings = { ...DEFAULT_SETTINGS, recordingEnabled: false, interSongPauseSec: 0 };
  state.complete.mockResolvedValue(undefined);
  state.load.mockResolvedValue(undefined);
  state.update.mockResolvedValue(undefined);
  state.exercises = [{ ...common, name: "Current exercise", sessionMinutes: 0.5, openEnded: false }];
  state.songs = [{ ...common, title: "Current song", defaultSessionMinutes: 5, troubleSpots: [], originalBpm: null }];
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

async function start(Page: React.ComponentType) {
  render(<Page />);
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(screen.queryByText(/Starting session/)).toBeNull();
}
async function pressSpace() {
  await act(async () => { fireEvent.keyDown(window, { code: "Space", key: " " }); });
}

describe.each([
  ["exercise", ExerciseSessionPage, 30, "/exercises/current"],
  ["song", SongSessionPage, 300, "/songs/current"],
] as const)("%s page completion pipeline", (kind, Page, seconds, destination) => {
  it("completes and routes once when Space is pressed during the final playing block", async () => {
    await start(Page);
    await pressSpace();
    expect(state.complete).toHaveBeenCalledTimes(1);
    expect(state.complete).toHaveBeenCalledWith(expect.objectContaining({ itemKind: kind, itemId: "current", endedReason: "complete" }));
    expect(state.push).toHaveBeenCalledWith(destination);
  });

  it("waits on natural expiry and completes only after Space", async () => {
    await start(Page);
    await act(async () => { vi.advanceTimersByTime((seconds + 1) * 1000); });
    expect(screen.getByText("Timer finished. Adjust BPM, repeat, or finish your session.")).toBeTruthy();
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();
    await pressSpace();
    expect(state.complete).toHaveBeenCalledTimes(1);
    expect(state.push).toHaveBeenCalledWith(destination);
  });

  it("shows finishing status while persistence is pending instead of returning to timer review", async () => {
    let resolve!: () => void;
    state.complete.mockImplementation(() => new Promise<void>((yes) => { resolve = yes; }));
    await start(Page);
    await pressSpace();
    expect(state.complete).toHaveBeenCalledTimes(1);
    expect(state.push).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Finishing session…");
    await act(async () => { vi.advanceTimersByTime((seconds + 1) * 1000); });
    expect(screen.getByRole("status").textContent).toBe("Finishing session…");
    expect(screen.queryByText("0:00")).toBeNull();
    expect(screen.queryByText("Timer finished. Adjust BPM, repeat, or finish your session.")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Repeat/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Finish/ })).toBeNull();
    await act(async () => resolve());
    expect(state.push).toHaveBeenCalledWith(destination);
    expect(state.push).toHaveBeenCalledTimes(1);
  });
});
