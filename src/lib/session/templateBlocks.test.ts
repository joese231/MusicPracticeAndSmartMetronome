import { describe, expect, it } from "vitest";
import type { SmartBlockRecipe } from "@/types/song";
import {
  activeRecipeEntries,
  allocateRecipeBlocks,
  tempoRuleBlock,
} from "./templateBlocks";

const recipe = (overrides: Partial<SmartBlockRecipe> = {}): SmartBlockRecipe => ({
  id: "r1",
  role: "ceilingWork",
  name: "Ceiling",
  purpose: "test",
  instructions: ["test"],
  enabled: true,
  duration: { kind: "percent", percent: 100 },
  tempoRule: { source: "working" },
  metronomeEnabled: true,
  progression: { kind: "working" },
  ...overrides,
});

describe("template block helpers", () => {
  it("keeps only enabled recipes with positive duration", () => {
    expect(
      activeRecipeEntries([
        recipe({ id: "enabled" }),
        recipe({ id: "disabled", enabled: false }),
        recipe({ id: "zero-fixed", duration: { kind: "fixed", seconds: 0 } }),
        recipe({ id: "zero-percent", duration: { kind: "percent", percent: 0 } }),
      ]).map((entry) => entry.id),
    ).toEqual(["enabled"]);
  });

  it("allocates recipe durations before mapping blocks", () => {
    const blocks = allocateRecipeBlocks(600, [
      recipe({ id: "fixed", duration: { kind: "fixed", seconds: 120 } }),
      recipe({ id: "percent", duration: { kind: "percent", percent: 100 } }),
    ], (entry, durationSec) => tempoRuleBlock(entry, durationSec, "custom"));

    expect(blocks.map((block) => [block.label, block.durationSec])).toEqual([
      ["Ceiling", 120],
      ["Ceiling", 480],
    ]);
  });

  it("returns no blocks for invalid allocation plans", () => {
    const blocks = allocateRecipeBlocks(600, [
      recipe({ id: "fixed", duration: { kind: "fixed", seconds: 60 } }),
    ], (entry, durationSec) => tempoRuleBlock(entry, durationSec, "custom"));

    expect(blocks).toEqual([]);
  });
});
