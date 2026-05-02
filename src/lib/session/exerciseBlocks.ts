import type { BlockDef } from "@/types/block";
import type { Exercise } from "@/types/exercise";
import type {
  ExerciseBlockKind,
  ExerciseBlockTemplate,
  ExerciseBlockTemplateEntry,
} from "@/types/song";
import {
  cloneExerciseTemplate,
  DEFAULT_EXERCISE_BLOCK_TEMPLATE,
} from "@/types/song";
import {
  buildSimpleMetronomeBlock,
  CONSCIOUS_PRACTICE_BLOCK,
  INSTRUCTIONS,
} from "./blocks";
import { overspeedBpm, slowReferenceBpm } from "./tempo";

export const DEFAULT_EXERCISE_MINUTES = 5;
export const MIN_EXERCISE_MINUTES = 5;
export const MAX_EXERCISE_MINUTES = 60;

const clampMinutes = (m: number): number => {
  if (!Number.isFinite(m)) return DEFAULT_EXERCISE_MINUTES;
  return Math.max(MIN_EXERCISE_MINUTES, Math.min(MAX_EXERCISE_MINUTES, Math.round(m)));
};

export const EXERCISE_BLOCK_FACTORIES: Record<
  ExerciseBlockKind,
  (durationSec: number) => BlockDef
> = {
  exerciseBuild: (durationSec) => ({
    kind: "exerciseBuild",
    label: "Build",
    durationSec,
    tempoFn: (s) => s.workingBpm,
    showEarnedButton: true,
    promotes: { kind: "working" },
    instructions: INSTRUCTIONS.exerciseBuild,
  }),
  exerciseBurst: (durationSec) => ({
    kind: "overspeed",
    label: "Burst",
    durationSec,
    tempoFn: overspeedBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.overspeed,
  }),
  exerciseCoolDown: (durationSec) => ({
    kind: "exerciseCoolDown",
    label: "Cool Down",
    durationSec,
    tempoFn: slowReferenceBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.exerciseCoolDown,
  }),
};

/**
 * Single open-ended block — count-up timer at the exercise's working BPM.
 */
export const OPEN_ENDED_BLOCK: BlockDef = {
  kind: "openEnded",
  label: "Open-ended",
  durationSec: 0,
  unbounded: true,
  tempoFn: (s) => s.workingBpm,
  showEarnedButton: false,
  promotes: null,
  instructions: INSTRUCTIONS.openEnded,
};

const exerciseTemplate = (e: Exercise): ExerciseBlockTemplate => {
  if (Array.isArray(e.blockTemplate) && e.blockTemplate.length > 0) {
    return e.blockTemplate;
  }
  return cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE);
};

const activeExerciseEntries = (
  template: ExerciseBlockTemplate,
): ExerciseBlockTemplateEntry[] =>
  template.filter((e) => e.enabled && e.weight > 0);

/**
 * Build the body (timed blocks only) for an exercise session of the given
 * minutes, using the exercise's template. Used internally by
 * `buildExerciseBlocks` and exposed for tests / preview UIs.
 */
export const buildExerciseTimedBlocks = (
  minutes: number,
  exercise?: Exercise,
): BlockDef[] => {
  const total = clampMinutes(minutes) * 60;
  const template = exercise
    ? exerciseTemplate(exercise)
    : cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE);
  const entries = activeExerciseEntries(template);
  if (entries.length === 0) return [];

  const totalWeight = entries.reduce((a, e) => a + e.weight, 0);
  const allocs = entries.map((e) => ({
    entry: e,
    secs: Math.floor((e.weight / totalWeight) * total),
  }));
  const allocatedSum = allocs.reduce((a, x) => a + x.secs, 0);
  const residual = total - allocatedSum;
  if (residual !== 0) {
    const buildIdx = allocs.findIndex((a) => a.entry.kind === "exerciseBuild");
    const idx = buildIdx >= 0 ? buildIdx : 0;
    allocs[idx].secs += residual;
  }

  return allocs.map(({ entry, secs }) =>
    EXERCISE_BLOCK_FACTORIES[entry.kind](secs),
  );
};

/**
 * Build the full block list for an exercise session. Branches on the
 * exercise's flags, in priority order:
 *  - openEnded === true     → single unbounded count-up block (no warm-up)
 *  - practiceMode === "simple" → optional Conscious Practice + a single
 *                                 steady-BPM block at workingBpm
 *  - otherwise (smart)      → optional Conscious Practice + the exercise's
 *                              template, allocated proportionally.
 */
export const buildExerciseBlocks = (exercise: Exercise): BlockDef[] => {
  if (exercise.openEnded) return [OPEN_ENDED_BLOCK];

  const out: BlockDef[] = [];
  if (exercise.includeWarmupBlock !== false) out.push(CONSCIOUS_PRACTICE_BLOCK);

  if (exercise.practiceMode === "simple") {
    const minutes = clampMinutes(exercise.sessionMinutes);
    out.push(buildSimpleMetronomeBlock(minutes * 60));
    return out;
  }

  out.push(...buildExerciseTimedBlocks(exercise.sessionMinutes, exercise));
  return out;
};
