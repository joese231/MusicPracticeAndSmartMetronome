import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SONG_BLOCK_TEMPLATE,
  DEFAULT_SONG_SESSION_MINUTES,
} from "@/types/song";
import { DEFAULT_EXERCISE_MINUTES } from "@/lib/session/exerciseBlocks";
import {
  validateExercise,
  validateExercisePatch,
  validateSettings,
  validateSettingsPatch,
  validateSessionRecord,
  validateSong,
  validateSongPatch,
} from "./validation";

const validSong = {
  id: "song-1",
  title: "Blackberry Blossom",
  link: null,
  workingBpm: 90,
  warmupBpm: null,
  troubleSpots: [],
  originalBpm: null,
  stepPercent: 2.5,
  practiceMode: "smart",
  includeWarmupBlock: true,
  blockTemplate: DEFAULT_SONG_BLOCK_TEMPLATE,
  defaultSessionMinutes: DEFAULT_SONG_SESSION_MINUTES,
  metronomeEnabled: true,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
};

const validExercise = {
  id: "exercise-1",
  name: "Forward roll",
  link: null,
  notes: null,
  workingBpm: 80,
  warmupBpm: null,
  stepPercent: 2.5,
  sessionMinutes: DEFAULT_EXERCISE_MINUTES,
  openEnded: false,
  metronomeEnabled: true,
  practiceMode: "smart",
  includeWarmupBlock: true,
  blockTemplate: DEFAULT_SETTINGS.defaultExerciseBlockTemplate,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
};

const validSessionRecord = {
  id: "session-1",
  itemId: "song-1",
  itemKind: "song",
  itemTitle: "Blackberry Blossom",
  startedAt: "2026-06-12T10:00:00.000Z",
  endedAt: "2026-06-12T10:10:00.000Z",
  durationSec: 600,
  endedReason: "manual",
  plannedMinutes: 10,
  startWorkingBpm: 90,
  endWorkingBpm: 92,
  startTroubleBpms: [],
  endTroubleBpms: [],
  promotions: [],
};

describe("api validation", () => {
  it("accepts a valid song and rejects malformed song rows", () => {
    expect(validateSong(validSong)).toEqual({ ok: true, value: validSong });
    expect(validateSong({ ...validSong, title: "" })).toEqual({
      ok: false,
      error: "song.title must be a non-empty string",
    });
    expect(validateSong({ ...validSong, practiceMode: "speedrun" })).toEqual({
      ok: false,
      error: "song.practiceMode is invalid",
    });
  });

  it("accepts only editable song patch fields", () => {
    expect(
      validateSongPatch({
        expectedUpdatedAt: validSong.updatedAt,
        patch: { title: "New title", workingBpm: 96 },
      }),
    ).toEqual({
      ok: true,
      value: {
        expectedUpdatedAt: validSong.updatedAt,
        patch: { title: "New title", workingBpm: 96 },
      },
    });

    expect(
      validateSongPatch({
        patch: { totalPracticeSec: 999 },
      }),
    ).toEqual({
      ok: false,
      error: "song patch field totalPracticeSec is not editable here",
    });
    expect(validateSongPatch({ patch: { sortIndex: 99 } })).toEqual({
      ok: false,
      error: "song patch field sortIndex is not editable here",
    });
  });

  it("accepts a valid exercise and rejects malformed exercise rows", () => {
    expect(validateExercise(validExercise)).toEqual({
      ok: true,
      value: validExercise,
    });
    expect(validateExercise({ ...validExercise, workingBpm: 0 })).toEqual({
      ok: false,
      error: "exercise.workingBpm must be a playable BPM",
    });
  });

  it("accepts only editable exercise patch fields", () => {
    expect(
      validateExercisePatch({
        expectedUpdatedAt: validExercise.updatedAt,
        patch: { name: "Cleaner roll", sessionMinutes: 10 },
      }),
    ).toEqual({
      ok: true,
      value: {
        expectedUpdatedAt: validExercise.updatedAt,
        patch: { name: "Cleaner roll", sessionMinutes: 10 },
      },
    });

    expect(validateExercisePatch({ patch: { id: "changed" } })).toEqual({
      ok: false,
      error: "exercise patch field id is not editable here",
    });
    expect(validateExercisePatch({ patch: { sortIndex: 99 } })).toEqual({
      ok: false,
      error: "exercise patch field sortIndex is not editable here",
    });
  });

  it("validates settings and settings patches", () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual({
      ok: true,
      value: DEFAULT_SETTINGS,
    });
    expect(validateSettingsPatch({ metronomeVolume: 0.5 })).toEqual({
      ok: true,
      value: { metronomeVolume: 0.5 },
    });
    expect(validateSettingsPatch({ metronomeVolume: 2 })).toEqual({
      ok: false,
      error: "settings.metronomeVolume must be between 0 and 1",
    });
  });

  it("validates song, exercise, and free-play session records", () => {
    expect(validateSessionRecord(validSessionRecord)).toEqual({
      ok: true,
      value: validSessionRecord,
    });
    expect(
      validateSessionRecord({
        ...validSessionRecord,
        itemKind: "exercise",
        itemId: "exercise-1",
      }),
    ).toEqual({
      ok: true,
      value: {
        ...validSessionRecord,
        itemKind: "exercise",
        itemId: "exercise-1",
      },
    });
    expect(
      validateSessionRecord({
        ...validSessionRecord,
        itemKind: "freePlay",
        itemId: "__freeplay__",
        startWorkingBpm: undefined,
        endWorkingBpm: undefined,
      }),
    ).toEqual({
      ok: true,
      value: {
        ...validSessionRecord,
        itemKind: "freePlay",
        itemId: "__freeplay__",
        startWorkingBpm: undefined,
        endWorkingBpm: undefined,
      },
    });
  });

  it("rejects malformed session records", () => {
    expect(validateSessionRecord({ ...validSessionRecord, itemKind: "jam" })).toEqual({
      ok: false,
      error: "session.itemKind is invalid",
    });
    expect(validateSessionRecord({ ...validSessionRecord, durationSec: -1 })).toEqual({
      ok: false,
      error: "session.durationSec must be non-negative",
    });
    expect(validateSessionRecord({ ...validSessionRecord, endedAt: "soon" })).toEqual({
      ok: false,
      error: "session timestamps must be ISO strings",
    });
  });
});
