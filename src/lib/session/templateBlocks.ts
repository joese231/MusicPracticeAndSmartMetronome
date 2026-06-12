import type { BlockDef } from "@/types/block";
import type { SmartBlockRecipe } from "@/types/song";
import { allocateValidatedBlockDurations } from "./duration";
import type { DurationAllocationResult } from "./duration";
import { evaluateTempoRule } from "./tempoRules";

export function activeRecipeEntries(template: SmartBlockRecipe[]): SmartBlockRecipe[] {
  return template.filter(
    (entry) =>
      entry.enabled &&
      (entry.duration.kind === "fixed"
        ? entry.duration.seconds > 0
        : entry.duration.percent > 0),
  );
}

export function allocateRecipeBlocks(
  totalSec: number,
  entries: SmartBlockRecipe[],
  toBlock: (entry: SmartBlockRecipe, durationSec: number) => BlockDef,
): BlockDef[] {
  const allocation = allocateRecipeDurations(totalSec, entries);
  if (!allocation.ok) return [];
  return entries.map((entry) => toBlock(entry, allocation.durations.get(entry.id) ?? 0));
}

export function allocateRecipeDurations(
  totalSec: number,
  entries: SmartBlockRecipe[],
): DurationAllocationResult {
  return allocateValidatedBlockDurations(
    totalSec,
    entries.map((entry) => ({ id: entry.id, duration: entry.duration })),
  );
}

export function tempoRuleBlock(
  entry: SmartBlockRecipe,
  durationSec: number,
  kind: BlockDef["kind"],
): BlockDef {
  const promotes =
    entry.progression.kind === "working" ? { kind: "working" as const } : null;
  return {
    kind,
    label: entry.name,
    durationSec,
    tempoFn: (subject) => evaluateTempoRule(entry.tempoRule, subject),
    showEarnedButton: entry.progression.kind === "working",
    promotes,
    instructions: entry.instructions,
    metronomeEnabled: entry.metronomeEnabled,
  };
}
