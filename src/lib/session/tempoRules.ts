import type { Song, TempoAdjustment, TempoRule } from "@/types/song";
import { overspeedBpm, step, targetBpm, workingBpmForTempo } from "./tempo";

export type TempoRuleContext = {
  troubleIndex?: number;
};

export function evaluateTempoRule(
  rule: TempoRule,
  song: Song,
  context: TempoRuleContext = {},
): number {
  const base = sourceBpm(rule, song, context);
  const adjustment = "adjustment" in rule ? rule.adjustment : undefined;
  return applyAdjustment(base, adjustment, song.stepPercent);
}

function sourceBpm(
  rule: TempoRule,
  song: Song,
  context: TempoRuleContext,
): number {
  switch (rule.source) {
    case "working":
      return workingBpmForTempo(song);
    case "target":
      return targetBpm(song);
    case "overspeed":
      return overspeedBpm(song);
    case "original":
      return song.originalBpm ?? evaluateTempoRule(rule.fallback, song, context);
    case "trouble": {
      const index = context.troubleIndex ?? 0;
      return (
        song.troubleSpots[index]?.bpm ??
        evaluateTempoRule(rule.fallback, song, context)
      );
    }
    case "fixed":
      return rule.bpm;
  }
}

function applyAdjustment(
  bpm: number,
  adjustment: TempoAdjustment | undefined,
  stepPercent: number,
): number {
  if (!adjustment) return Math.round(bpm);
  switch (adjustment.kind) {
    case "percent":
      return Math.round(bpm * (adjustment.value / 100));
    case "bpmOffset":
      return Math.round(bpm + adjustment.value);
    case "steps": {
      let out = bpm;
      const count = Math.abs(Math.round(adjustment.value));
      for (let i = 0; i < count; i++) {
        out =
          adjustment.value >= 0
            ? step(out, stepPercent)
            : Math.round(out / (1 + stepPercent / 100));
      }
      return out;
    }
  }
}
