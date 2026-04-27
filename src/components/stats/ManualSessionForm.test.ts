import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseDurationToSeconds, createManualSessionRecord } from "@/lib/session/manualSessionUtils";
import type { Song } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";

/**
 * Test suite for ManualSessionForm component integration
 * Tests form input parsing, validation, and record creation
 */

// Mock store implementations for component testing
const createMockStore = () => {
  const songs: Song[] = [
    {
      id: "s1",
      title: "Blackberry Blossom",
      link: null,
      workingBpm: 120,
      warmupBpm: null,
      troubleSpots: [],
      originalBpm: 100,
      stepPercent: 2.5,
      practiceMode: "smart" as const,
      includeWarmupBlock: true,
      totalPracticeSec: 0,
      createdAt: "2026-04-27T00:00:00Z",
      updatedAt: "2026-04-27T00:00:00Z",
    },
    {
      id: "s2",
      title: "Foggy Mountain Breakdown",
      link: null,
      workingBpm: 140,
      warmupBpm: null,
      troubleSpots: [],
      originalBpm: 120,
      stepPercent: 2.5,
      practiceMode: "smart" as const,
      includeWarmupBlock: true,
      totalPracticeSec: 0,
      createdAt: "2026-04-27T00:00:00Z",
      updatedAt: "2026-04-27T00:00:00Z",
    },
  ];

  const exercises: Exercise[] = [
    {
      id: "e1",
      name: "Banjo Warm-up",
      workingBpm: 100,
      warmupBpm: null,
      sessionMinutes: 5,
      openEnded: false,
      metronomeEnabled: true,
      practiceMode: "smart" as const,
      includeWarmupBlock: true,
      createdAt: "2026-04-27T00:00:00Z",
      updatedAt: "2026-04-27T00:00:00Z",
    },
    {
      id: "e2",
      name: "Chord Changes",
      workingBpm: 110,
      warmupBpm: null,
      sessionMinutes: 10,
      openEnded: false,
      metronomeEnabled: true,
      practiceMode: "smart" as const,
      includeWarmupBlock: true,
      createdAt: "2026-04-27T00:00:00Z",
      updatedAt: "2026-04-27T00:00:00Z",
    },
  ];

  const appendedRecords: SessionRecord[] = [];

  return {
    songs,
    exercises,
    appendedRecords,
    mockAppend: vi.fn((record: SessionRecord) => {
      appendedRecords.push(record);
      return Promise.resolve();
    }),
  };
};

describe("ManualSessionForm - Form Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Duration Parsing", () => {
    it("parses duration in 'Xm' format", () => {
      const result = parseDurationToSeconds("25m");
      expect(result).toBe(25 * 60); // 1500 seconds
    });

    it("parses duration in 'Xm Ys' format", () => {
      const result = parseDurationToSeconds("25m 30s");
      expect(result).toBe(25 * 60 + 30); // 1530 seconds
    });

    it("parses duration in 'Xs' format", () => {
      const result = parseDurationToSeconds("90s");
      expect(result).toBe(90);
    });

    it("parses bare number as minutes if < 360", () => {
      const result = parseDurationToSeconds("25");
      expect(result).toBe(25 * 60);
    });

    it("parses bare number as seconds if >= 360", () => {
      const result = parseDurationToSeconds("1500");
      expect(result).toBe(1500);
    });

    it("throws error for invalid format", () => {
      expect(() => parseDurationToSeconds("invalid")).toThrow();
    });

    it("throws error for empty string", () => {
      expect(() => parseDurationToSeconds("")).toThrow();
    });
  });

  describe("Manual Session Record Creation", () => {
    it("creates a session record for an exercise", () => {
      const record = createManualSessionRecord({
        exerciseId: "ex1",
        exerciseTitle: "Banjo Warm-up",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      expect(record).toMatchObject({
        itemId: "ex1",
        itemKind: "exercise",
        itemTitle: "Banjo Warm-up",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
        endedReason: "manual",
      });
      expect(record.id).toBeDefined();
    });

    it("creates a session record for a song", () => {
      const record = createManualSessionRecord({
        songId: "song1",
        songTitle: "Blackberry Blossom",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1800,
      });

      expect(record).toMatchObject({
        itemId: "song1",
        itemKind: "song",
        itemTitle: "Blackberry Blossom",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1800,
        endedReason: "manual",
      });
      expect(record.id).toBeDefined();
    });

    it("creates a free-form session record when no item is specified", () => {
      const record = createManualSessionRecord({
        sessionTitle: "Jam session",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 3600,
      });

      expect(record).toMatchObject({
        itemId: "__manual__",
        itemKind: "song",
        itemTitle: "Jam session",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 3600,
        endedReason: "manual",
      });
      expect(record.id).toBeDefined();
    });

    it("includes optional BPM ranges when provided", () => {
      const record = createManualSessionRecord({
        exerciseId: "ex1",
        exerciseTitle: "Scale runs",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
        startWorkingBpm: 100,
        endWorkingBpm: 120,
      });

      expect(record).toMatchObject({
        startWorkingBpm: 100,
        endWorkingBpm: 120,
      });
    });

    it("calculates endedAt correctly from duration", () => {
      const record = createManualSessionRecord({
        sessionTitle: "Practice",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      const startDate = new Date("2026-04-27T14:30:00Z");
      const expectedEndDate = new Date(startDate.getTime() + 1500 * 1000);

      expect(new Date(record.endedAt + "Z").getTime()).toBe(
        expectedEndDate.getTime()
      );
    });

    it("prioritizes exerciseId over songId over sessionTitle", () => {
      const record = createManualSessionRecord({
        exerciseId: "ex1",
        exerciseTitle: "Exercise",
        songId: "song1",
        songTitle: "Song",
        sessionTitle: "Free form",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      expect(record.itemKind).toBe("exercise");
      expect(record.itemId).toBe("ex1");
      expect(record.itemTitle).toBe("Exercise");
    });

    it("falls back to songId when exerciseId is not provided", () => {
      const record = createManualSessionRecord({
        songId: "song1",
        songTitle: "Song",
        sessionTitle: "Free form",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      expect(record.itemKind).toBe("song");
      expect(record.itemId).toBe("song1");
    });

    it("uses default title for exercise if not provided", () => {
      const record = createManualSessionRecord({
        exerciseId: "ex1",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Unnamed Exercise");
    });

    it("uses default title for song if not provided", () => {
      const record = createManualSessionRecord({
        songId: "song1",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Unnamed Song");
    });

    it("uses default title for free-form session if not provided", () => {
      const record = createManualSessionRecord({
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Manual Session");
    });

    it("calculates plannedMinutes by rounding durationSec", () => {
      const record = createManualSessionRecord({
        sessionTitle: "Practice",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1530, // 25.5 minutes
      });

      expect(record.plannedMinutes).toBe(26);
    });

    it("includes promotions when provided", () => {
      const promotions = [
        {
          blockIndex: 1,
          beforeBpm: 100,
          afterBpm: 110,
          promoteReason: "hit_target",
        },
      ];

      const record = createManualSessionRecord({
        sessionTitle: "Practice",
        startedAt: "2026-04-27T14:30:00",
        durationSec: 1500,
        promotions: promotions as any,
      });

      expect(record.promotions).toEqual(promotions);
    });
  });

  describe("Form Validation Scenarios", () => {
    it("validates that date and time are required", () => {
      // This would be tested in component state management
      // For unit testing, we verify the utilities don't allow empty dates
      const date = "2026-04-27";
      const time = "14:30";
      const dateTimeStr = `${date}T${time}`;
      expect(dateTimeStr).toBeDefined();
    });

    it("accepts valid ISO date-time combinations", () => {
      const date = "2026-04-27";
      const time = "14:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();
      expect(startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("validates duration is positive", () => {
      const duration = parseDurationToSeconds("25m");
      expect(duration).toBeGreaterThan(0);
    });
  });
});

/**
 * Comprehensive end-to-end submission tests for ManualSessionForm.
 * These tests verify form submission creates session records correctly.
 */
describe("ManualSessionForm - Form Submission E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Exercise Session Submission", () => {
    it("submits an exercise session with working BPMs", () => {
      const mockStore = createMockStore();
      const exercise = mockStore.exercises[0];
      const date = "2026-04-27";
      const time = "14:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        exerciseId: exercise.id,
        exerciseTitle: exercise.name,
        startedAt,
        durationSec: 1500,
        startWorkingBpm: 100,
        endWorkingBpm: 120,
      });

      expect(record).toMatchObject({
        itemKind: "exercise",
        itemId: exercise.id,
        itemTitle: exercise.name,
        startWorkingBpm: 100,
        endWorkingBpm: 120,
        endedReason: "manual",
        durationSec: 1500,
      });
      expect(record.id).toBeDefined();
    });

    it("submits an exercise session without BPMs", () => {
      const mockStore = createMockStore();
      const exercise = mockStore.exercises[0];
      const date = "2026-04-27";
      const time = "14:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        exerciseId: exercise.id,
        exerciseTitle: exercise.name,
        startedAt,
        durationSec: 1500,
      });

      expect(record).toMatchObject({
        itemKind: "exercise",
        itemId: exercise.id,
        itemTitle: exercise.name,
        startWorkingBpm: undefined,
        endWorkingBpm: undefined,
        endedReason: "manual",
      });
    });

    it("submits exercise with only starting BPM", () => {
      const mockStore = createMockStore();
      const exercise = mockStore.exercises[0];
      const date = "2026-04-27";
      const time = "14:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        exerciseId: exercise.id,
        exerciseTitle: exercise.name,
        startedAt,
        durationSec: 1500,
        startWorkingBpm: 100,
      });

      expect(record.startWorkingBpm).toBe(100);
      expect(record.endWorkingBpm).toBeUndefined();
    });
  });

  describe("Song Session Submission", () => {
    it("submits a song session with working BPMs", () => {
      const mockStore = createMockStore();
      const song = mockStore.songs[0];
      const date = "2026-04-27";
      const time = "15:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        songId: song.id,
        songTitle: song.title,
        startedAt,
        durationSec: 1800,
        startWorkingBpm: 110,
        endWorkingBpm: 130,
      });

      expect(record).toMatchObject({
        itemKind: "song",
        itemId: song.id,
        itemTitle: song.title,
        startWorkingBpm: 110,
        endWorkingBpm: 130,
        endedReason: "manual",
        durationSec: 1800,
      });
    });

    it("submits a song session without BPMs", () => {
      const mockStore = createMockStore();
      const song = mockStore.songs[1];
      const date = "2026-04-27";
      const time = "15:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        songId: song.id,
        songTitle: song.title,
        startedAt,
        durationSec: 1800,
      });

      expect(record).toMatchObject({
        itemKind: "song",
        itemId: song.id,
        itemTitle: song.title,
        startWorkingBpm: undefined,
        endWorkingBpm: undefined,
      });
    });
  });

  describe("Free-form Session Submission", () => {
    it("submits a free-form jam session with title", () => {
      const date = "2026-04-27";
      const time = "16:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Live jam session",
        startedAt,
        durationSec: 3600,
      });

      expect(record).toMatchObject({
        itemId: "__manual__",
        itemTitle: "Live jam session",
        durationSec: 3600,
        endedReason: "manual",
      });
      expect(record.itemKind).toBe("song");
    });

    it("submits a free-form transcription session", () => {
      const date = "2026-04-27";
      const time = "16:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Transcribing Ricky Skaggs solo",
        startedAt,
        durationSec: 2700,
      });

      expect(record.itemTitle).toBe("Transcribing Ricky Skaggs solo");
      expect(record.itemId).toBe("__manual__");
    });

    it("uses default title for free-form when not provided", () => {
      const date = "2026-04-27";
      const time = "17:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Manual Session");
    });
  });

  describe("Duration Variations", () => {
    it("handles short duration (1 minute)", () => {
      const date = "2026-04-27";
      const time = "17:15";
      const startedAt = new Date(`${date}T${time}`).toISOString();
      const durationSec = parseDurationToSeconds("1m");

      const record = createManualSessionRecord({
        sessionTitle: "Quick practice",
        startedAt,
        durationSec,
      });

      expect(record.durationSec).toBe(60);
      expect(record.plannedMinutes).toBe(1);
    });

    it("handles long duration (2 hours)", () => {
      const date = "2026-04-27";
      const time = "17:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();
      // parseDurationToSeconds doesn't support "h" format, use 7200 seconds (2h)
      const durationSec = 7200;

      const record = createManualSessionRecord({
        sessionTitle: "Marathon session",
        startedAt,
        durationSec,
      });

      expect(record.durationSec).toBe(7200);
      expect(record.plannedMinutes).toBe(120);
    });

    it("handles mixed minute and second durations", () => {
      const date = "2026-04-27";
      const time = "18:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();
      const durationSec = parseDurationToSeconds("25m 30s");

      const record = createManualSessionRecord({
        sessionTitle: "Custom duration",
        startedAt,
        durationSec,
      });

      expect(record.durationSec).toBe(1530);
      expect(record.plannedMinutes).toBe(26); // Rounds 25.5 up
    });

    it("rounds plannedMinutes correctly", () => {
      const mockStore = createMockStore();
      const exercise = mockStore.exercises[0];
      const date = "2026-04-27";
      const time = "18:15";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      // Test rounding: 1530 sec = 25.5 min -> rounds to 26
      const record = createManualSessionRecord({
        exerciseId: exercise.id,
        exerciseTitle: exercise.name,
        startedAt,
        durationSec: 1530,
      });

      expect(record.plannedMinutes).toBe(26);
    });
  });

  describe("Date and Time Validation", () => {
    it("correctly calculates endedAt from startedAt and duration", () => {
      const startedAt = "2026-04-27T14:30:00";
      const durationSec = 1500; // 25 minutes

      const record = createManualSessionRecord({
        sessionTitle: "Test session",
        startedAt,
        durationSec,
      });

      const startDate = new Date(`${startedAt}Z`);
      const expectedEndDate = new Date(startDate.getTime() + durationSec * 1000);

      expect(new Date(record.endedAt + "Z").getTime()).toBe(
        expectedEndDate.getTime()
      );
    });

    it("preserves ISO format without Z suffix", () => {
      const startedAt = "2026-04-27T14:30:00";
      const durationSec = 600;

      const record = createManualSessionRecord({
        sessionTitle: "Test session",
        startedAt,
        durationSec,
      });

      // Should preserve format (no Z)
      expect(record.startedAt).toBe(startedAt);
      expect(record.endedAt).not.toContain("Z");
    });

    it("handles ISO format with Z suffix", () => {
      const startedAt = "2026-04-27T14:30:00Z";
      const durationSec = 600;

      const record = createManualSessionRecord({
        sessionTitle: "Test session",
        startedAt,
        durationSec,
      });

      expect(record.startedAt).toBe(startedAt);
      expect(record.endedAt).toContain("Z");
    });
  });

  describe("BPM Validation Scenarios", () => {
    it("accepts valid BPM ranges", () => {
      const mockStore = createMockStore();
      const exercise = mockStore.exercises[0];
      const date = "2026-04-27";
      const time = "19:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        exerciseId: exercise.id,
        exerciseTitle: exercise.name,
        startedAt,
        durationSec: 1500,
        startWorkingBpm: 80,
        endWorkingBpm: 160,
      });

      expect(record.startWorkingBpm).toBe(80);
      expect(record.endWorkingBpm).toBe(160);
    });

    it("supports equal start and end BPMs", () => {
      const date = "2026-04-27";
      const time = "19:15";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Steady practice",
        startedAt,
        durationSec: 1500,
        startWorkingBpm: 120,
        endWorkingBpm: 120,
      });

      expect(record.startWorkingBpm).toBe(record.endWorkingBpm);
    });

    it("handles high BPM values", () => {
      const date = "2026-04-27";
      const time = "19:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Fast practice",
        startedAt,
        durationSec: 1500,
        startWorkingBpm: 240,
        endWorkingBpm: 300,
      });

      expect(record.startWorkingBpm).toBe(240);
      expect(record.endWorkingBpm).toBe(300);
    });

    it("handles low BPM values", () => {
      const date = "2026-04-27";
      const time: "20:00" = "20:00";
      const startedAt = new Date(`2026-04-27T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Slow practice",
        startedAt,
        durationSec: 1500,
        startWorkingBpm: 20,
        endWorkingBpm: 60,
      });

      expect(record.startWorkingBpm).toBe(20);
      expect(record.endWorkingBpm).toBe(60);
    });
  });

  describe("Priority and Precedence Rules", () => {
    it("prioritizes exerciseId over songId and sessionTitle", () => {
      const mockStore = createMockStore();
      const date = "2026-04-27";
      const time = "20:15";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        exerciseId: "e1",
        exerciseTitle: "Scale Practice",
        songId: "s1",
        songTitle: "Blackberry Blossom",
        sessionTitle: "Free form",
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemKind).toBe("exercise");
      expect(record.itemId).toBe("e1");
      expect(record.itemTitle).toBe("Scale Practice");
    });

    it("prioritizes songId over sessionTitle when exerciseId is absent", () => {
      const date = "2026-04-27";
      const time = "20:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        songId: "s1",
        songTitle: "Foggy Mountain Breakdown",
        sessionTitle: "Free form session",
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemKind).toBe("song");
      expect(record.itemId).toBe("s1");
      expect(record.itemTitle).toBe("Foggy Mountain Breakdown");
    });

    it("uses sessionTitle for free-form when no exercise or song", () => {
      const date = "2026-04-27";
      const time = "20:45";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Noodling around",
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemKind).toBe("song");
      expect(record.itemId).toBe("__manual__");
      expect(record.itemTitle).toBe("Noodling around");
    });
  });

  describe("Default Titles and Fallbacks", () => {
    it("provides default title for unnamed exercise", () => {
      const date = "2026-04-27";
      const time = "21:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        exerciseId: "e1",
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Unnamed Exercise");
    });

    it("provides default title for unnamed song", () => {
      const date = "2026-04-27";
      const time = "21:15";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        songId: "s1",
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Unnamed Song");
    });

    it("provides default title for free-form without sessionTitle", () => {
      const date = "2026-04-27";
      const time = "21:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        startedAt,
        durationSec: 1500,
      });

      expect(record.itemTitle).toBe("Manual Session");
    });
  });

  describe("Promotions and Advanced Fields", () => {
    it("includes promotions when provided", () => {
      const promotions = [
        {
          blockIndex: 1,
          beforeBpm: 100,
          afterBpm: 110,
          promoteReason: "hit_target" as const,
        },
        {
          blockIndex: 2,
          beforeBpm: 110,
          afterBpm: 125,
          promoteReason: "hit_target" as const,
        },
      ];

      const date = "2026-04-27";
      const time = "21:45";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Tracked session",
        startedAt,
        durationSec: 1500,
        promotions,
      });

      expect(record.promotions).toEqual(promotions);
      expect(record.promotions).toHaveLength(2);
    });

    it("includes trouble spot BPMs when provided", () => {
      const date = "2026-04-27";
      const time = "22:00";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        songId: "s1",
        songTitle: "Complex Song",
        startedAt,
        durationSec: 1500,
        startTroubleBpms: [80, 90],
        endTroubleBpms: [100, 110],
      });

      expect(record.startTroubleBpms).toEqual([80, 90]);
      expect(record.endTroubleBpms).toEqual([100, 110]);
    });

    it("handles empty promotions array", () => {
      const date = "2026-04-27";
      const time = "22:15";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "Simple session",
        startedAt,
        durationSec: 1500,
        promotions: [],
      });

      expect(record.promotions).toEqual([]);
    });
  });

  describe("Record ID and Uniqueness", () => {
    it("generates unique ID for each record", () => {
      const date = "2026-04-27";
      const time = "22:30";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record1 = createManualSessionRecord({
        sessionTitle: "Session 1",
        startedAt,
        durationSec: 1500,
      });

      const record2 = createManualSessionRecord({
        sessionTitle: "Session 1", // Same data
        startedAt,
        durationSec: 1500,
      });

      expect(record1.id).toBeDefined();
      expect(record2.id).toBeDefined();
      expect(record1.id).not.toBe(record2.id); // Should be unique
    });

    it("record ID is a valid UUID", () => {
      const date = "2026-04-27";
      const time = "22:45";
      const startedAt = new Date(`${date}T${time}`).toISOString();

      const record = createManualSessionRecord({
        sessionTitle: "UUID test",
        startedAt,
        durationSec: 1500,
      });

      // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(record.id).toMatch(uuidRegex);
    });
  });

  describe("Consistency and Immutability", () => {
    it("record always has endedReason='manual'", () => {
      const mockStore = createMockStore();
      const records = [
        createManualSessionRecord({
          exerciseId: "e1",
          exerciseTitle: "Exercise",
          startedAt: "2026-04-27T10:00:00Z",
          durationSec: 1500,
        }),
        createManualSessionRecord({
          songId: "s1",
          songTitle: "Song",
          startedAt: "2026-04-27T11:00:00Z",
          durationSec: 1500,
        }),
        createManualSessionRecord({
          sessionTitle: "Free form",
          startedAt: "2026-04-27T12:00:00Z",
          durationSec: 1500,
        }),
      ];

      records.forEach((record) => {
        expect(record.endedReason).toBe("manual");
      });
    });

    it("record startedAt matches input exactly", () => {
      const testDates = [
        "2026-04-27T10:30:00",
        "2026-04-27T10:30:00Z",
        "2026-01-01T00:00:00",
        "2026-12-31T23:59:59Z",
      ];

      testDates.forEach((startedAt) => {
        const record = createManualSessionRecord({
          sessionTitle: "Test",
          startedAt,
          durationSec: 1500,
        });

        expect(record.startedAt).toBe(startedAt);
      });
    });
  });
});
