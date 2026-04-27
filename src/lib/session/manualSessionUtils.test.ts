import { describe, it, expect } from "vitest";
import { parseDurationToSeconds, createManualSessionRecord } from "./manualSessionUtils";

// FREE_FORM_SESSION_ID is not exported, but we know the test expects "__manual__"
const FREE_FORM_SESSION_ID = "__manual__";

describe("parseDurationToSeconds", () => {
  it("parses minutes only", () => {
    expect(parseDurationToSeconds("25")).toBe(1500);
  });

  it("parses minutes with m suffix", () => {
    expect(parseDurationToSeconds("25m")).toBe(1500);
  });

  it("parses minutes and seconds", () => {
    expect(parseDurationToSeconds("25m 30s")).toBe(1530);
  });

  it("parses seconds only", () => {
    expect(parseDurationToSeconds("90s")).toBe(90);
  });

  it("parses total seconds without suffix", () => {
    expect(parseDurationToSeconds("1530")).toBe(1530);
  });

  it("handles whitespace", () => {
    expect(parseDurationToSeconds("  25m  30s  ")).toBe(1530);
  });

  it("throws on invalid input", () => {
    expect(() => parseDurationToSeconds("invalid")).toThrow();
    expect(() => parseDurationToSeconds("")).toThrow();
  });

  it("parses '359' as 21540 (under threshold, minutes)", () => {
    expect(parseDurationToSeconds("359")).toBe(21540);
  });

  it("parses '360' as 360 (at threshold, seconds)", () => {
    expect(parseDurationToSeconds("360")).toBe(360);
  });
});

describe("createManualSessionRecord", () => {
  it("creates a manual session record for an exercise", () => {
    const record = createManualSessionRecord({
      exerciseId: "ex1",
      exerciseTitle: "Banjo Warm-up",
      startedAt: "2026-04-27T14:30:00",
      durationSec: 1500,
      startWorkingBpm: 100,
      endWorkingBpm: 120,
    });

    expect(record.id).toBeDefined();
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/); // UUID v4 format
    expect(record.itemId).toBe("ex1");
    expect(record.itemTitle).toBe("Banjo Warm-up");
    expect(record.itemKind).toBe("exercise");
    expect(record.startedAt).toBe("2026-04-27T14:30:00");
    expect(record.endedAt).toBe("2026-04-27T14:55:00"); // 25 minutes later
    expect(record.durationSec).toBe(1500);
    expect(record.endedReason).toBe("manual");
    expect(record.startWorkingBpm).toBe(100);
    expect(record.endWorkingBpm).toBe(120);
    expect(record.promotions).toEqual([]);
    expect(record.startTroubleBpms).toEqual([]);
    expect(record.endTroubleBpms).toEqual([]);
  });

  it("creates a manual session record for a song", () => {
    const record = createManualSessionRecord({
      songId: "s1",
      songTitle: "Blackberry Blossom",
      startedAt: "2026-04-27T15:00:00",
      durationSec: 3600,
    });

    expect(record.itemId).toBe("s1");
    expect(record.itemKind).toBe("song");
    expect(record.itemTitle).toBe("Blackberry Blossom");
    expect(record.durationSec).toBe(3600);
  });

  it("creates a free-form manual session with no exercise or song", () => {
    const record = createManualSessionRecord({
      startedAt: "2026-04-27T14:30:00",
      durationSec: 3600,
      sessionTitle: "Jam session",
    });

    expect(record.itemId).toBe(FREE_FORM_SESSION_ID);
    expect(record.itemTitle).toBe("Jam session");
    expect(record.itemKind).toBe("song"); // Default to song for free-form
    expect(record.startWorkingBpm).toBeUndefined();
    expect(record.endWorkingBpm).toBeUndefined();
  });

  it("calculates endedAt correctly based on duration", () => {
    const record = createManualSessionRecord({
      sessionTitle: "Test",
      startedAt: "2026-04-27T14:30:00.000Z",
      durationSec: 90,
    });

    // 14:30:00 + 90 seconds = 14:31:30
    expect(record.endedAt).toBe("2026-04-27T14:31:30.000Z");
  });

  it("includes promotions if provided", () => {
    const promotions = [
      {
        at: "2026-04-27T14:35:00",
        kind: "working" as const,
        fromBpm: 100,
        toBpm: 105,
        stepPercent: 2.5,
      },
    ];

    const record = createManualSessionRecord({
      exerciseId: "ex1",
      exerciseTitle: "Test",
      startedAt: "2026-04-27T14:30:00",
      durationSec: 1500,
      promotions,
    });

    expect(record.promotions).toEqual(promotions);
  });

  it("sets plannedMinutes as rounded duration", () => {
    const record1 = createManualSessionRecord({
      sessionTitle: "25.5 minute session",
      startedAt: "2026-04-27T14:30:00",
      durationSec: 1530, // 25.5 minutes
    });

    expect(record1.plannedMinutes).toBe(26); // Rounded

    const record2 = createManualSessionRecord({
      sessionTitle: "90 second session",
      startedAt: "2026-04-27T14:30:00",
      durationSec: 90,
    });

    expect(record2.plannedMinutes).toBe(2); // Rounded
  });
});
