import { describe, expect, it } from "vitest";
import {
  buildExerciseSessionRecord,
  buildFreePlaySessionRecord,
  buildLatestRecording,
  buildSongSessionRecord,
  intermissionRemainingSec,
  resumeIntermission,
} from "./sessionArtifacts";

describe("session artifact builders", () => {
  it("builds song session records with rounded elapsed time", () => {
    const record = buildSongSessionRecord({
      id: "session-1",
      itemId: "song-1",
      itemTitle: "Tune",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:05:00.000Z",
      elapsedSec: 299.6,
      endedReason: "complete",
      plannedMinutes: 5,
      startWorkingBpm: 100,
      endWorkingBpm: 103,
      startTroubleBpms: [90],
      endTroubleBpms: [92],
      promotions: [],
    });

    expect(record).toMatchObject({
      id: "session-1",
      itemKind: "song",
      itemId: "song-1",
      durationSec: 300,
      plannedMinutes: 5,
      startWorkingBpm: 100,
      endWorkingBpm: 103,
      startTroubleBpms: [90],
      endTroubleBpms: [92],
    });
  });

  it("builds exercise and free-play records with the correct item kinds", () => {
    const exercise = buildExerciseSessionRecord({
      id: "exercise-session",
      itemId: "exercise-1",
      itemTitle: "Roll",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:05:00.000Z",
      elapsedSec: 300,
      endedReason: "abort",
      plannedMinutes: 5,
      startWorkingBpm: 120,
      endWorkingBpm: 123,
      promotions: [],
    });
    const freePlay = buildFreePlaySessionRecord({
      id: "free-session",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:03:00.000Z",
      elapsedSec: 180,
      bpm: 100,
    });

    expect(exercise.itemKind).toBe("exercise");
    expect(exercise.startTroubleBpms).toEqual([]);
    expect(freePlay.itemKind).toBe("freePlay");
    expect(freePlay.itemId).toBe("__freeplay__");
  });

  it("builds latest recording metadata from item/session identity", () => {
    const blob = new Blob(["audio"]);
    const recording = buildLatestRecording({
      itemKind: "exercise",
      itemId: "exercise-1",
      sessionId: "session-1",
      blob,
      blobUrl: "blob://recording",
      durationSec: 42,
      plannedMinutes: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(recording).toEqual({
      itemKind: "exercise",
      itemId: "exercise-1",
      sessionId: "session-1",
      blob,
      blobUrl: "blob://recording",
      durationSec: 42,
      plannedMinutes: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("intermission helpers", () => {
  it("derives remaining seconds and shifts start time on resume", () => {
    const current = {
      nextItemId: "next",
      nextItemTitle: "Next",
      startedAtMs: 1_000,
      durationSec: 20,
    };

    expect(intermissionRemainingSec(current, 5_500)).toBe(16);
    expect(resumeIntermission(current, 8_000, 11_500)).toEqual({
      ...current,
      startedAtMs: 4_500,
    });
  });
});
