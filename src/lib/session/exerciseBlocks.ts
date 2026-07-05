import type { BlockDef } from "@/types/block";
import type { Exercise } from "@/types/exercise";
import type {
  ExerciseBlockTemplate,
  SmartBlockRecipe,
} from "@/types/song";
import {
  cloneExerciseTemplate,
  DEFAULT_EXERCISE_BLOCK_TEMPLATE,
} from "@/types/song";
import {
  blockBuildFailureMessage,
  type BlockBuildPlan,
  buildSimpleMetronomeBlock,
  buildTimedPracticeBlock,
  CONSCIOUS_PRACTICE_BLOCK,
  INSTRUCTIONS,
} from "./blocks";
import { workingBpmForTempo } from "./tempo";
import {
  activeRecipeEntries,
  allocateRecipeBlocks,
  allocateRecipeDurations,
  tempoRuleBlock,
} from "./templateBlocks";

export const DEFAULT_EXERCISE_MINUTES = 5;
export const MIN_EXERCISE_MINUTES = 5;
export const MAX_EXERCISE_MINUTES = 60;

const clampMinutes = (m: number): number => {
  if (!Number.isFinite(m)) return DEFAULT_EXERCISE_MINUTES;
  return Math.max(MIN_EXERCISE_MINUTES, Math.min(MAX_EXERCISE_MINUTES, Math.round(m)));
};

/**
 * Single open-ended block — count-up timer at the exercise's working BPM.
 */
export const OPEN_ENDED_BLOCK: BlockDef = {
  kind: "openEnded",
  label: "Open-ended",
  durationSec: 0,
  unbounded: true,
  tempoFn: (s) => workingBpmForTempo(s),
  showEarnedButton: false,
  promotes: null,
  instructions: INSTRUCTIONS.openEnded,
  metronomeEnabled: true,
};

const exerciseTemplate = (e: Exercise): ExerciseBlockTemplate => {
  if (Array.isArray(e.blockTemplate) && e.blockTemplate.length > 0) {
    return e.blockTemplate;
  }
  return cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE);
};

const activeExerciseEntries = (
  template: ExerciseBlockTemplate,
): SmartBlockRecipe[] =>
  activeRecipeEntries(template);

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
  return allocateRecipeBlocks(total, entries, exerciseRecipeToBlock);
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
  return buildExerciseBlockPlan(exercise).blocks;
};

export const buildExerciseBlockPlan = (exercise: Exercise): BlockBuildPlan => {
  if (exercise.openEnded || exercise.practiceMode === "openEnded") {
    return {
      ok: true,
      blocks: [
        {
          ...OPEN_ENDED_BLOCK,
          metronomeEnabled: exercise.metronomeEnabled !== false,
        },
      ],
    };
  }

  const out: BlockDef[] = [];
  if (exercise.includeWarmupBlock !== false) out.push(CONSCIOUS_PRACTICE_BLOCK);

  if (exercise.practiceMode === "simple") {
    const minutes = clampMinutes(exercise.sessionMinutes);
    out.push({
      ...buildSimpleMetronomeBlock(minutes * 60),
      metronomeEnabled: exercise.metronomeEnabled !== false,
    });
    return { ok: true, blocks: out };
  }

  if (exercise.practiceMode === "timed") {
    const minutes = clampMinutes(exercise.sessionMinutes);
    out.push(buildTimedPracticeBlock(minutes * 60, exercise.metronomeEnabled !== false));
    return { ok: true, blocks: out };
  }

  const total = clampMinutes(exercise.sessionMinutes) * 60;
  const entries = activeExerciseEntries(exerciseTemplate(exercise));
  if (entries.length === 0) {
    return {
      ok: false,
      kind: "emptyBody",
      reason: "no-active-blocks",
      message: blockBuildFailureMessage("exercise", "no-active-blocks"),
      blocks: out,
    };
  }

  const allocation = allocateRecipeDurations(total, entries);
  if (!allocation.ok) {
    return {
      ok: false,
      kind: "invalidTemplate",
      reason: allocation.reason,
      message: blockBuildFailureMessage("exercise", allocation.reason),
      blocks: out,
    };
  }

  out.push(
    ...entries.map((entry) =>
      exerciseRecipeToBlock(entry, allocation.durations.get(entry.id) ?? 0),
    ),
  );
  return { ok: true, blocks: out };
};

function exerciseRecipeToBlock(
  entry: SmartBlockRecipe,
  durationSec: number,
): BlockDef {
  const kind =
    entry.role === "exerciseBuild"
      ? "exerciseBuild"
      : entry.role === "exerciseCoolDown"
        ? "exerciseCoolDown"
        : entry.role === "exerciseBurst"
          ? "overspeed"
          : "custom";
  return {
    ...tempoRuleBlock(entry, durationSec, kind),
    instructions:
      entry.instructions.length > 0
        ? entry.instructions
        : kind === "overspeed"
          ? INSTRUCTIONS.overspeed
          : INSTRUCTIONS.exerciseBuild,
    metronomeEnabled: entry.metronomeEnabled,
  };
}
