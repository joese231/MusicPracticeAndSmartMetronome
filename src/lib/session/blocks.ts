import type { BlockDef } from "@/types/block";
import type {
  Song,
  SongBlockTemplate,
  SmartBlockRecipe,
} from "@/types/song";
import type { DurationAllocationResult } from "./duration";
import type { TempoSubject } from "./runtimeTypes";
import {
  DEFAULT_SONG_BLOCK_TEMPLATE,
  cloneSongTemplate,
} from "@/types/song";
import {
  troubleBlockBpmFor,
  warmupBpmFor,
  workingBpmForTempo,
} from "./tempo";
import { evaluateTempoRule } from "./tempoRules";
import {
  activeRecipeEntries,
  allocateRecipeDurations,
  tempoRuleBlock,
} from "./templateBlocks";

type DurationFailureReason = Extract<
  DurationAllocationResult,
  { ok: false }
>["reason"];

export type BlockBuildFailureReason =
  | DurationFailureReason
  | "no-active-blocks"
  | "no-base-blocks";

export type BlockBuildPlan =
  | { ok: true; blocks: BlockDef[] }
  | {
      ok: false;
      kind: "invalidTemplate" | "emptyBody";
      reason: BlockBuildFailureReason;
      message: string;
      blocks: BlockDef[];
    };

export const blockBuildFailureMessage = (
  itemKind: "song" | "exercise",
  reason: BlockBuildFailureReason,
): string => {
  const item = itemKind === "song" ? "song" : "exercise";
  switch (reason) {
    case "fixed-exceeds-total":
      return `The fixed smart-template blocks are longer than this ${item}'s saved session length. Shorten fixed blocks or increase the session length before starting.`;
    case "fixed-underfills-total":
      return `The fixed smart-template blocks do not fill this ${item}'s saved session length. Add time, change a block to percent of remaining time, or reduce the saved length before starting.`;
    case "percent-exceeds-100":
      return `A smart-template percent block is above 100%. Lower it before starting this ${item}.`;
    case "no-positive-percent":
      return `This smart template has remaining time assigned to percent blocks, but none of those percent blocks has a positive value. Add a positive percent value before starting.`;
    case "no-base-blocks":
      return itemKind === "song"
        ? "This smart song template has no enabled non-trouble blocks. Add at least one base block before starting."
        : "This smart exercise template has no enabled timed blocks. Add at least one block before starting.";
    case "no-active-blocks":
      return `This smart ${item} template has no enabled blocks with a positive duration. Enable a block before starting.`;
  }
};

const okBlockPlan = (blocks: BlockDef[]): BlockBuildPlan => ({
  ok: true,
  blocks,
});

const invalidBlockPlan = (
  blocks: BlockDef[],
  kind: "invalidTemplate" | "emptyBody",
  reason: BlockBuildFailureReason,
  itemKind: "song" | "exercise",
): BlockBuildPlan => ({
  ok: false,
  kind,
  reason,
  message: blockBuildFailureMessage(itemKind, reason),
  blocks,
});

export const INSTRUCTIONS: Record<string, string[]> = {
  consciousPractice: [
    "Very slow, very conscious — one click, one note.",
    "Perfect the little movements: make them precise, efficient, and relaxed.",
    "Feel every motion of each hand. Release unnecessary tension before moving on.",
    "Timer counts up — end the block when the motion feels clean and settled.",
  ],
  slowReference: [
    "Play the full tune, slowly and relaxed.",
    "You're not chasing anything — this is a warm-up.",
    "Listen for tone, check pick angle, notice any tension.",
  ],
  troubleSpot: [
    "Loop just the hardest 1–2 bars of the tune.",
    "Play them at a tempo where they are GENUINELY clean in isolation.",
    "Three consecutive clean-and-relaxed reps earns the next rung — tap 'I earned it'.",
    "If you stack 3 tense reps, drop the tempo and reset the feel.",
  ],
  ceilingWork: [
    "Full tune at the target tempo — this is the push.",
    "Three consecutive clean-and-relaxed reps earns a new working tempo.",
    "Tense-survival reps don't count. If three tense reps stack up, drop back.",
  ],
  overspeed: [
    "One or two fast bursts above your target. Messy is OK.",
    "The point is to make the target tempo feel slow when you drop back.",
    "Don't try to earn anything here — just push.",
  ],
  consolidation: [
    "One or two deliberate, relaxed reps at ~70% of working tempo.",
    "Lean into the music — phrasing, swing, let open strings ring.",
    "End on a clean rep. Always.",
  ],
  exerciseBuild: [
    "Target tempo — internalize the motion cleanly.",
    "Three consecutive clean-and-relaxed reps earns a new working tempo — tap +.",
    "If three tense reps stack, drop the tempo and reset the feel.",
  ],
  exerciseCoolDown: [
    "Slow and relaxed — release any tension from the burst.",
    "Last reps of the session — make them the cleanest.",
    "End on a clean rep. Always.",
  ],
  openEnded: [
    "Just play. No timer, no targets — the clock counts up.",
    "Press End (or Esc) when you're done. Your time is recorded.",
  ],
  simpleMetronome: [
    "Plain metronome at your working BPM — no ladder, no targets, no promotions.",
    "Just play until the timer ends. Take it as a long sustained pass.",
  ],
  timedPractice: [
    "Timed practice — work on the song for the saved session length.",
    "No ladder, no targets, no promotions. End when the timer finishes.",
  ],
  freePlay: [
    "Free play — count-up timer for unstructured practice.",
    "Toggle the metronome on/off below if you want a click. Press End (or Esc) when you're done.",
  ],
};

/**
 * Conscious Practice warm-up. Prepended once to every session regardless
 * of length. `unbounded: true` means the driver never auto-advances off it;
 * the player presses N / Next when they're ready. Metronome plays at the
 * song's saved `warmupBpm` if set, else ⅓ × workingBpm (floored at 20).
 */
export const CONSCIOUS_PRACTICE_BLOCK: BlockDef = {
  kind: "consciousPractice",
  label: "Conscious Practice",
  durationSec: 0,
  unbounded: true,
  tempoFn: warmupBpmFor,
  showEarnedButton: false,
  promotes: null,
  instructions: INSTRUCTIONS.consciousPractice,
};

/**
 * Single steady-BPM block at the song/exercise's working BPM. Used by
 * "simple" practice mode to mimic a regular metronome with a stop timer.
 */
export const buildSimpleMetronomeBlock = (durationSec: number): BlockDef => ({
  kind: "simpleMetronome",
  label: "Steady BPM",
  durationSec,
  tempoFn: (s: TempoSubject) => workingBpmForTempo(s),
  showEarnedButton: true,
  promotes: { kind: "working" },
  instructions: INSTRUCTIONS.simpleMetronome,
  metronomeEnabled: true,
});

export const buildTimedPracticeBlock = (
  durationSec: number,
  metronomeEnabled: boolean,
): BlockDef => ({
  kind: "timedPractice",
  label: "Timed Practice",
  durationSec,
  tempoFn: (s: TempoSubject) => workingBpmForTempo(s),
  showEarnedButton: false,
  promotes: null,
  instructions: INSTRUCTIONS.timedPractice,
  metronomeEnabled,
});

export const buildOpenEndedSongBlock = (metronomeEnabled: boolean): BlockDef => ({
  kind: "openEnded",
  label: "Open-ended",
  durationSec: 0,
  unbounded: true,
  tempoFn: (s: TempoSubject) => workingBpmForTempo(s),
  showEarnedButton: false,
  promotes: null,
  instructions: INSTRUCTIONS.openEnded,
  metronomeEnabled,
});

export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 60;

export const clampSessionMinutes = (n: number): number => {
  if (!Number.isFinite(n)) return 10;
  const rounded = Math.round(n);
  if (rounded < MIN_SESSION_MINUTES) return MIN_SESSION_MINUTES;
  if (rounded > MAX_SESSION_MINUTES) return MAX_SESSION_MINUTES;
  return rounded;
};

const wantsWarmup = (song: Song): boolean =>
  song.includeWarmupBlock !== false;

/** Resolve the song's template, falling back to default for legacy rows. */
export const songTemplate = (song: Song): SongBlockTemplate => {
  if (Array.isArray(song.blockTemplate) && song.blockTemplate.length > 0) {
    return song.blockTemplate;
  }
  return cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE);
};

/** Filter to entries that should appear in the session. */
const activeEntries = (
  template: SongBlockTemplate,
  troubleCount: number,
): SmartBlockRecipe[] =>
  activeRecipeEntries(template).filter(
    (entry) => entry.role !== "troubleSpot" || troubleCount > 0,
  );

const baseEntries = (
  template: SongBlockTemplate,
  troubleCount: number,
): SmartBlockRecipe[] =>
  activeEntries(template, troubleCount).filter((e) => e.role !== "troubleSpot");

const additiveTroubleEntries = (
  template: SongBlockTemplate,
  troubleCount: number,
): SmartBlockRecipe[] =>
  troubleCount > 0
    ? activeEntries(template, troubleCount).filter((e) => e.role === "troubleSpot")
    : [];

const additiveDurationSec = (
  entry: SmartBlockRecipe,
  baseTotalSec: number,
): number =>
  entry.duration.kind === "fixed"
    ? Math.max(0, Math.round(entry.duration.seconds))
    : Math.max(0, Math.round((entry.duration.percent / 100) * baseTotalSec));

/**
 * Smart-mode body length: total seconds across all timed blocks (excludes
 * the unbounded Conscious Practice prefix). Always exactly `minutes * 60`
 * when the template has at least one active row.
 */
export const sessionLengthSec = (minutes: number, song: Song): number => {
  if (song.practiceMode === "openEnded") return 0;
  if (song.practiceMode === "simple" || song.practiceMode === "timed") {
    return minutes * 60;
  }
  const template = songTemplate(song);
  const troubleCount = song.troubleSpots.length;
  const entries = baseEntries(template, troubleCount);
  if (entries.length === 0) return 0;
  const totalSec = minutes * 60;
  const allocation = allocateRecipeDurations(totalSec, entries);
  if (!allocation.ok) return 0;
  const baseTotal = [...allocation.durations.values()].reduce((a, b) => a + b, 0);
  const additiveTotal = additiveTroubleEntries(template, troubleCount).reduce(
    (sum, entry) => sum + additiveDurationSec(entry, totalSec) * troubleCount,
    0,
  );
  return baseTotal + additiveTotal;
};

export const songBlockStructureKey = (song: Song): string =>
  JSON.stringify({
    practiceMode: song.practiceMode,
    includeWarmupBlock: song.includeWarmupBlock,
    metronomeEnabled: song.metronomeEnabled,
    troubleSpotCount: song.troubleSpots.length,
    blockTemplate: songTemplate(song),
  });

/**
 * Build the block list for a session of `minutes` minutes against a song.
 *
 * - `simple` → optional Conscious Practice + a single steady-BPM block.
 * - `smart`  → optional Conscious Practice + the song's template, allocated
 *   proportionally so that the timed blocks sum exactly to `minutes * 60`.
 *   Trouble-spot rows replicate per spot, sharing the row's allocated time.
 *   Empty / all-disabled templates yield no body blocks (caller should
 *   prevent saving such a config from the form).
 */
export const buildBlockPlan = (minutes: number, song: Song): BlockBuildPlan => {
  const result: BlockDef[] = [];

  if (song.practiceMode === "openEnded") {
    return okBlockPlan([buildOpenEndedSongBlock(song.metronomeEnabled !== false)]);
  }

  if (wantsWarmup(song)) result.push(CONSCIOUS_PRACTICE_BLOCK);

  if (song.practiceMode === "simple") {
    result.push(buildSimpleMetronomeBlock(minutes * 60));
    return okBlockPlan(result);
  }

  if (song.practiceMode === "timed") {
    result.push(buildTimedPracticeBlock(minutes * 60, song.metronomeEnabled !== false));
    return okBlockPlan(result);
  }

  const template = songTemplate(song);
  const troubleCount = song.troubleSpots.length;
  const entries = activeEntries(template, troubleCount);
  if (entries.length === 0) {
    return invalidBlockPlan(result, "emptyBody", "no-active-blocks", "song");
  }

  const totalSec = minutes * 60;
  const timedEntries = baseEntries(template, troubleCount);
  if (timedEntries.length === 0) {
    return invalidBlockPlan(result, "emptyBody", "no-base-blocks", "song");
  }
  const allocation =
    timedEntries.length > 0 ? allocateRecipeDurations(totalSec, timedEntries) : null;
  if (allocation && !allocation.ok) {
    return invalidBlockPlan(result, "invalidTemplate", allocation.reason, "song");
  }

  for (const entry of entries) {
    if (entry.role === "troubleSpot") {
      const secs = additiveDurationSec(entry, totalSec);
      for (let i = 0; i < troubleCount; i++) {
        const promotes =
          entry.progression.kind === "trouble"
            ? ({ kind: "trouble", index: i } as const)
            : entry.progression.kind === "working"
              ? ({ kind: "working" } as const)
              : null;
        result.push({
          kind: "troubleSpot",
          label: troubleCount > 1 ? `${entry.name} ${i + 1}` : entry.name,
          durationSec: secs,
          tempoFn: (s: TempoSubject) =>
            evaluateTempoRule(entry.tempoRule, s, { troubleIndex: i }),
          showEarnedButton: promotes !== null,
          promotes,
          instructions: entry.instructions,
          metronomeEnabled: entry.metronomeEnabled,
        });
      }
    } else {
      const secs = allocation?.durations.get(entry.id) ?? 0;
      result.push(recipeToBlock(entry, secs));
    }
  }

  return okBlockPlan(result);
};

export const buildBlocks = (minutes: number, song: Song): BlockDef[] =>
  buildBlockPlan(minutes, song).blocks;

function recipeToBlock(entry: SmartBlockRecipe, durationSec: number): BlockDef {
  const roleKind =
    entry.role === "custom" ||
    entry.role === "exerciseBurst" ||
    entry.role === "exerciseBuild" ||
    entry.role === "exerciseCoolDown"
      ? "custom"
      : entry.role;
  return tempoRuleBlock(entry, durationSec, roleKind);
}
