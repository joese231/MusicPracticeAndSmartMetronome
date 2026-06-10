import { describe, expect, it } from "vitest";
import { evaluateTempoRule } from "./tempoRules";
import type { Song, TempoRule } from "@/types/song";

const song = (overrides: Partial<Song> = {}): Song => ({
  id: "s1",
  title: "Test",
  link: null,
  workingBpm: 120,
  warmupBpm: null,
  troubleSpots: [{ bpm: 88 }, { bpm: null }],
  originalBpm: 160,
  stepPercent: 2.5,
  practiceMode: "smart",
  includeWarmupBlock: true,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "",
  updatedAt: "",
  ...overrides,
  defaultSessionMinutes: overrides.defaultSessionMinutes ?? 10,
  metronomeEnabled: overrides.metronomeEnabled ?? true,
});

describe("evaluateTempoRule", () => {
  it("evaluates a percent of working BPM", () => {
    const rule: TempoRule = {
      source: "working",
      adjustment: { kind: "percent", value: 70 },
    };

    expect(evaluateTempoRule(rule, song())).toBe(84);
  });

  it("evaluates fixed BPM", () => {
    expect(evaluateTempoRule({ source: "fixed", bpm: 101 }, song())).toBe(101);
  });

  it("evaluates BPM offsets from original BPM", () => {
    const rule: TempoRule = {
      source: "original",
      adjustment: { kind: "bpmOffset", value: -10 },
      fallback: { source: "working" },
    };

    expect(evaluateTempoRule(rule, song())).toBe(150);
  });

  it("falls back when original BPM is missing", () => {
    const rule: TempoRule = {
      source: "original",
      fallback: {
        source: "working",
        adjustment: { kind: "percent", value: 80 },
      },
    };

    expect(evaluateTempoRule(rule, song({ originalBpm: null }))).toBe(96);
  });

  it("evaluates ladder steps from working BPM", () => {
    const rule: TempoRule = {
      source: "working",
      adjustment: { kind: "steps", value: 2 },
    };

    expect(evaluateTempoRule(rule, song())).toBe(126);
  });

  it("evaluates target and overspeed sources", () => {
    expect(evaluateTempoRule({ source: "target" }, song())).toBe(123);
    expect(evaluateTempoRule({ source: "overspeed" }, song())).toBe(126);
  });

  it("uses saved trouble BPM when present", () => {
    const rule: TempoRule = {
      source: "trouble",
      fallback: { source: "working", adjustment: { kind: "percent", value: 80 } },
    };

    expect(evaluateTempoRule(rule, song(), { troubleIndex: 0 })).toBe(88);
  });

  it("falls back when trouble BPM is missing", () => {
    const rule: TempoRule = {
      source: "trouble",
      fallback: { source: "working", adjustment: { kind: "percent", value: 80 } },
    };

    expect(evaluateTempoRule(rule, song(), { troubleIndex: 1 })).toBe(96);
  });
});
