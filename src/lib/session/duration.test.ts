import { describe, expect, it } from "vitest";
import { allocateBlockDurations } from "./duration";
import type { BlockDurationRule } from "@/types/song";

type Row = { id: string; duration: BlockDurationRule };

const rows = (items: Row[]): Row[] => items;

describe("allocateBlockDurations", () => {
  it("splits all-percent blocks across the full session", () => {
    const result = allocateBlockDurations(
      600,
      rows([
        { id: "a", duration: { kind: "percent", percent: 25 } },
        { id: "b", duration: { kind: "percent", percent: 75 } },
      ]),
    );

    expect(result).toEqual({
      ok: true,
      durations: new Map([
        ["a", 150],
        ["b", 450],
      ]),
      fixedSec: 0,
      remainingSec: 600,
    });
  });

  it("allocates fixed blocks first and divides remaining time by percentages", () => {
    const result = allocateBlockDurations(
      600,
      rows([
        { id: "fixed", duration: { kind: "fixed", seconds: 120 } },
        { id: "half-a", duration: { kind: "percent", percent: 50 } },
        { id: "half-b", duration: { kind: "percent", percent: 50 } },
      ]),
    );

    expect(result).toEqual({
      ok: true,
      durations: new Map([
        ["fixed", 120],
        ["half-a", 240],
        ["half-b", 240],
      ]),
      fixedSec: 120,
      remainingSec: 480,
    });
  });

  it("normalizes percentage totals instead of requiring them to equal 100", () => {
    const result = allocateBlockDurations(
      300,
      rows([
        { id: "one", duration: { kind: "percent", percent: 1 } },
        { id: "two", duration: { kind: "percent", percent: 2 } },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected allocation to succeed");
    expect(result.durations).toEqual(
      new Map([
        ["one", 100],
        ["two", 200],
      ]),
    );
  });

  it("puts rounding residual on the first percent block", () => {
    const result = allocateBlockDurations(
      10,
      rows([
        { id: "a", duration: { kind: "percent", percent: 1 } },
        { id: "b", duration: { kind: "percent", percent: 1 } },
        { id: "c", duration: { kind: "percent", percent: 1 } },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected allocation to succeed");
    expect(result.durations).toEqual(
      new Map([
        ["a", 4],
        ["b", 3],
        ["c", 3],
      ]),
    );
  });

  it("returns an error when fixed blocks exceed the session length", () => {
    const result = allocateBlockDurations(
      60,
      rows([
        { id: "a", duration: { kind: "fixed", seconds: 45 } },
        { id: "b", duration: { kind: "fixed", seconds: 30 } },
      ]),
    );

    expect(result).toEqual({
      ok: false,
      reason: "fixed-exceeds-total",
      fixedSec: 75,
      totalSec: 60,
    });
  });

  it("keeps fixed-only blocks flat instead of stretching them to fill the session", () => {
    const result = allocateBlockDurations(
      600,
      rows([
        { id: "a", duration: { kind: "fixed", seconds: 120 } },
        { id: "b", duration: { kind: "fixed", seconds: 60 } },
      ]),
    );

    expect(result).toEqual({
      ok: true,
      durations: new Map([
        ["a", 120],
        ["b", 60],
      ]),
      fixedSec: 180,
      remainingSec: 420,
    });
  });

  it("returns an error when enabled percent blocks have no positive percent", () => {
    const result = allocateBlockDurations(
      60,
      rows([{ id: "a", duration: { kind: "percent", percent: 0 } }]),
    );

    expect(result).toEqual({
      ok: false,
      reason: "no-positive-percent",
      fixedSec: 0,
      remainingSec: 60,
    });
  });
});
