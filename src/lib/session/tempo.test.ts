import { describe, it, expect } from "vitest";
import {
  step,
  targetBpm,
  overspeedBpm,
  slowReferenceBpm,
  slowMusicalBpm,
  troubleBlockBpmFor,
  promoteWorking,
  promoteTroubleAt,
} from "./tempo";
import type { Song, TroubleSpot } from "@/types/song";

const baseSong = (overrides: Partial<Song> = {}): Song => ({
  id: "s1",
  title: "Test",
  link: null,
  workingBpm: 220,
  warmupBpm: null,
  troubleSpots: [{ bpm: 150 }],
  originalBpm: null,
  stepPercent: 2.5,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("step", () => {
  it("rounds to nearest whole BPM", () => {
    expect(step(220, 2.5)).toBe(226); // 220 * 1.025 = 225.5 → 226
    expect(step(150, 2.5)).toBe(154); // 150 * 1.025 = 153.75 → 154
    expect(step(40, 2.5)).toBe(41);
    expect(step(400, 2.5)).toBe(410);
  });

  it("handles larger and smaller step percents", () => {
    expect(step(100, 5)).toBe(105);
    expect(step(100, 10)).toBe(110);
    expect(step(100, 0.5)).toBe(101); // 100.5 → 101
  });
});

describe("derived tempos", () => {
  it("computes target as one step above working", () => {
    expect(targetBpm(baseSong())).toBe(226);
  });

  it("computes overspeed as two steps above working", () => {
    expect(overspeedBpm(baseSong())).toBe(232);
  });

  it("slowReferenceBpm is 77% of working", () => {
    expect(slowReferenceBpm(baseSong())).toBe(Math.round(220 * 0.77));
  });

  it("slowMusicalBpm is 72% of working", () => {
    expect(slowMusicalBpm(baseSong())).toBe(Math.round(220 * 0.72));
  });
});

describe("troubleBlockBpmFor", () => {
  it("returns the BPM of the requested trouble spot", () => {
    const spots: TroubleSpot[] = [{ bpm: 150 }, { bpm: 180 }];
    const s = baseSong({ troubleSpots: spots });
    expect(troubleBlockBpmFor(s, 0)).toBe(150);
    expect(troubleBlockBpmFor(s, 1)).toBe(180);
  });

  it("falls back to slowReferenceBpm when the spot BPM is null", () => {
    const s = baseSong({ troubleSpots: [{ bpm: null }] });
    expect(troubleBlockBpmFor(s, 0)).toBe(Math.round(220 * 0.77));
  });

  it("falls back to slowReferenceBpm for out-of-range indices", () => {
    const s = baseSong({ troubleSpots: [{ bpm: 150 }] });
    expect(troubleBlockBpmFor(s, 5)).toBe(Math.round(220 * 0.77));
  });
});

describe("promotions", () => {
  it("promoteWorking steps workingBpm and bumps updatedAt", () => {
    const s = baseSong();
    const promoted = promoteWorking(s);
    expect(promoted.workingBpm).toBe(226);
    expect(promoted.troubleSpots).toEqual([{ bpm: 150 }]);
    expect(promoted.updatedAt).not.toBe(s.updatedAt);
  });

  it("promoteTroubleAt steps only the targeted spot", () => {
    const s = baseSong({ troubleSpots: [{ bpm: 150 }, { bpm: 180 }] });
    const promoted = promoteTroubleAt(s, 0);
    expect(promoted.troubleSpots[0].bpm).toBe(154);
    expect(promoted.troubleSpots[1].bpm).toBe(180);
    expect(promoted.workingBpm).toBe(220);
  });

  it("promoteTroubleAt steps a later spot without touching earlier ones", () => {
    const s = baseSong({ troubleSpots: [{ bpm: 150 }, { bpm: 180 }] });
    const promoted = promoteTroubleAt(s, 1);
    expect(promoted.troubleSpots[0].bpm).toBe(150);
    expect(promoted.troubleSpots[1].bpm).toBe(185); // 180 * 1.025 = 184.5 → 185
  });

  it("promoteTroubleAt is a no-op when the spot BPM is null", () => {
    const s = baseSong({ troubleSpots: [{ bpm: null }] });
    expect(promoteTroubleAt(s, 0)).toBe(s);
  });

  it("promoteTroubleAt is a no-op for out-of-range indices", () => {
    const s = baseSong();
    expect(promoteTroubleAt(s, 5)).toBe(s);
  });
});
