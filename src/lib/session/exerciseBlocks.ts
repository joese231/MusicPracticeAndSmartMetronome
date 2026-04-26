import type { BlockDef } from "@/types/block";
import { CONSCIOUS_PRACTICE_BLOCK, INSTRUCTIONS } from "./blocks";
import { overspeedBpm, slowReferenceBpm } from "./tempo";

/** Default session length for new exercises. */
export const DEFAULT_EXERCISE_MINUTES = 5;
/** Allowed range — UI inputs and `buildExerciseBlocks` clamp to this. */
export const MIN_EXERCISE_MINUTES = 5;
export const MAX_EXERCISE_MINUTES = 60;

const BURST_SEC = 90;
const COOL_DOWN_SEC = 30;
/** Burst (90s) + Cool Down (30s). Build = total - this. */
const FIXED_TAIL_SEC = BURST_SEC + COOL_DOWN_SEC;

const clampMinutes = (m: number): number => {
  if (!Number.isFinite(m)) return DEFAULT_EXERCISE_MINUTES;
  return Math.max(MIN_EXERCISE_MINUTES, Math.min(MAX_EXERCISE_MINUTES, Math.round(m)));
};

/**
 * Sandwich shape: Build (working) → Burst (overspeed) → Cool Down (slow) so
 * the session ends at a relaxed tempo — last memory rep is clean.
 *
 * Burst (90s) and Cool Down (30s) are fixed; Build absorbs all extra time.
 * Only Build earns. Burst and Cool Down derive from working, so promoting in
 * Build automatically scales them for the next pass.
 */
export const buildExerciseTimedBlocks = (minutes: number): BlockDef[] => {
  const total = clampMinutes(minutes) * 60;
  const buildSec = total - FIXED_TAIL_SEC;
  return [
    {
      kind: "exerciseBuild",
      label: "Build",
      durationSec: buildSec,
      tempoFn: (s) => s.workingBpm,
      showEarnedButton: true,
      promotes: { kind: "working" },
      instructions: INSTRUCTIONS.exerciseBuild,
    },
    {
      kind: "overspeed",
      label: "Burst",
      durationSec: BURST_SEC,
      tempoFn: overspeedBpm,
      showEarnedButton: false,
      promotes: null,
      instructions: INSTRUCTIONS.overspeed,
    },
    {
      kind: "exerciseCoolDown",
      label: "Cool Down",
      durationSec: COOL_DOWN_SEC,
      tempoFn: slowReferenceBpm,
      showEarnedButton: false,
      promotes: null,
      instructions: INSTRUCTIONS.exerciseCoolDown,
    },
  ];
};

/**
 * Build the full block list for an exercise session of `minutes` minutes.
 * Always prepends the unbounded Conscious Practice warm-up — same warm-up
 * shape as songs.
 */
export const buildExerciseBlocks = (minutes: number): BlockDef[] => [
  CONSCIOUS_PRACTICE_BLOCK,
  ...buildExerciseTimedBlocks(minutes),
];
