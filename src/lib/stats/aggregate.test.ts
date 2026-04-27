import { describe, it, expect } from "vitest";
import {
  byDayMinutes,
  bpmTimeline,
  promotionVelocity,
  stalledSongs,
  totalPracticeMinutes,
  currentStreakDays,
} from "./aggregate";
import type { SessionRecord, PromotionEvent } from "@/types/sessionRecord";
import type { Song } from "@/types/song";

const mkRec = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  id: overrides.id ?? "r1",
  itemId: "s1",
  itemKind: "song",
  itemTitle: "Test",
  startedAt: "2026-04-01T10:00:00.000Z",
  endedAt: "2026-04-01T10:10:00.000Z",
  durationSec: 600,
  endedReason: "complete",
  plannedMinutes: 10,
  startWorkingBpm: 200,
  endWorkingBpm: 200,
  startTroubleBpms: [],
  endTroubleBpms: [],
  promotions: [],
  ...overrides,
});

const mkPromo = (at: string, fromBpm = 200, toBpm = 205): PromotionEvent => ({
  at,
  kind: "working",
  fromBpm,
  toBpm,
  stepPercent: 2.5,
});

const mkSong = (id: string): Song => ({
  id,
  title: id,
  link: null,
  workingBpm: 200,
  warmupBpm: null,
  troubleSpots: [],
  originalBpm: null,
  stepPercent: 2.5,
  practiceMode: "smart",
  includeWarmupBlock: true,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("byDayMinutes", () => {
  it("returns empty map for empty input", () => {
    expect(byDayMinutes([]).size).toBe(0);
  });

  it("sums minutes per day", () => {
    const recs = [
      mkRec({ id: "a", startedAt: "2026-04-01T10:00:00Z", durationSec: 600 }),
      mkRec({ id: "b", startedAt: "2026-04-01T15:00:00Z", durationSec: 300 }),
      mkRec({ id: "c", startedAt: "2026-04-02T10:00:00Z", durationSec: 1200 }),
    ];
    const m = byDayMinutes(recs);
    // The date key uses local time; assert the day has *some* minutes summed
    // and that the second day contains a separate entry.
    expect(m.size).toBe(2);
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo((600 + 300 + 1200) / 60);
  });
});

describe("bpmTimeline", () => {
  it("returns empty array for no matching item", () => {
    expect(bpmTimeline([], "s1")).toEqual([]);
  });

  it("emits start point for first record then end points", () => {
    const recs = [
      mkRec({
        id: "a",
        startedAt: "2026-04-01T10:00:00Z",
        endedAt: "2026-04-01T10:10:00Z",
        startWorkingBpm: 200,
        endWorkingBpm: 205,
      }),
      mkRec({
        id: "b",
        startedAt: "2026-04-02T10:00:00Z",
        endedAt: "2026-04-02T10:10:00Z",
        startWorkingBpm: 205,
        endWorkingBpm: 210,
      }),
    ];
    const points = bpmTimeline(recs, "s1");
    expect(points.length).toBe(3);
    expect(points[0].workingBpm).toBe(200);
    expect(points[1].workingBpm).toBe(205);
    expect(points[2].workingBpm).toBe(210);
  });

  it("ignores other items", () => {
    const recs = [
      mkRec({ itemId: "other", endWorkingBpm: 999 }),
      mkRec({ itemId: "s1", endWorkingBpm: 210 }),
    ];
    const points = bpmTimeline(recs, "s1");
    expect(points.every((p) => p.workingBpm !== 999)).toBe(true);
  });
});

describe("promotionVelocity", () => {
  it("zero on no promotions", () => {
    const v = promotionVelocity([mkRec()], "s1");
    expect(v).toEqual({ count: 0, avgDaysBetween: null, lastAt: null });
  });

  it("avgDaysBetween is null with single promotion", () => {
    const r = mkRec({ promotions: [mkPromo("2026-04-01T10:00:00Z")] });
    const v = promotionVelocity([r], "s1");
    expect(v.count).toBe(1);
    expect(v.avgDaysBetween).toBeNull();
  });

  it("computes avg across multiple promotions", () => {
    const r1 = mkRec({
      id: "a",
      promotions: [mkPromo("2026-04-01T10:00:00Z")],
    });
    const r2 = mkRec({
      id: "b",
      promotions: [
        mkPromo("2026-04-03T10:00:00Z"),
        mkPromo("2026-04-05T10:00:00Z"),
      ],
    });
    const v = promotionVelocity([r1, r2], "s1");
    expect(v.count).toBe(3);
    // span = 4 days across 2 gaps = 2 days/promotion
    expect(v.avgDaysBetween).toBeCloseTo(2);
  });
});

describe("stalledSongs", () => {
  it("flags songs with no promotion in window", () => {
    const songs = [mkSong("s1"), mkSong("s2")];
    const recs = [
      mkRec({
        itemId: "s1",
        promotions: [mkPromo("2026-04-20T10:00:00Z")],
      }),
    ];
    // now = 2026-04-25, threshold 3 days → s1 last promo 2026-04-20 is stale.
    const stalled = stalledSongs(recs, songs, 3, new Date("2026-04-25T00:00:00Z"));
    expect(stalled.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("does not flag songs with recent promotions", () => {
    const songs = [mkSong("s1")];
    const recs = [
      mkRec({
        itemId: "s1",
        promotions: [mkPromo("2026-04-24T10:00:00Z")],
      }),
    ];
    const stalled = stalledSongs(recs, songs, 7, new Date("2026-04-25T00:00:00Z"));
    expect(stalled).toEqual([]);
  });
});

describe("totalPracticeMinutes", () => {
  it("sums durationSec across records", () => {
    const recs = [
      mkRec({ durationSec: 600 }),
      mkRec({ durationSec: 1200 }),
    ];
    expect(totalPracticeMinutes(recs)).toBe(30);
  });
});

describe("currentStreakDays", () => {
  it("returns 0 with no records", () => {
    expect(currentStreakDays([])).toBe(0);
  });

  it("counts consecutive days back from today", () => {
    // Use local-day records so dayKey() lines up regardless of TZ.
    const today = new Date("2026-04-25T12:00:00");
    const yesterday = new Date("2026-04-24T12:00:00");
    const dayBefore = new Date("2026-04-23T12:00:00");
    const recs = [
      mkRec({ id: "a", startedAt: today.toISOString(), durationSec: 600 }),
      mkRec({ id: "b", startedAt: yesterday.toISOString(), durationSec: 600 }),
      mkRec({ id: "c", startedAt: dayBefore.toISOString(), durationSec: 600 }),
    ];
    expect(currentStreakDays(recs, today)).toBe(3);
  });
});
