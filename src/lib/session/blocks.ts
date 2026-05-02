import type { BlockDef } from "@/types/block";
import type {
  Song,
  SongBlockKind,
  SongBlockTemplate,
  SongBlockTemplateEntry,
} from "@/types/song";
import {
  DEFAULT_SONG_BLOCK_TEMPLATE,
  cloneSongTemplate,
} from "@/types/song";
import {
  consolidationBpm,
  overspeedBpm,
  slowReferenceBpm,
  targetBpm,
  troubleBlockBpmFor,
  warmupBpmFor,
} from "./tempo";

export const INSTRUCTIONS: Record<string, string[]> = {
  consciousPractice: [
    "Very slow, very conscious — one click, one note.",
    "Feel every motion of each hand. Land exactly on the click.",
    "Timer counts up — end the block when you feel warmed up.",
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
    "Working tempo — internalize the motion cleanly.",
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
  tempoFn: (s: Song) => s.workingBpm,
  showEarnedButton: true,
  promotes: { kind: "working" },
  instructions: INSTRUCTIONS.simpleMetronome,
});

/** Per-kind block factory: turns a kind + duration into a full BlockDef. */
export const SONG_BLOCK_FACTORIES: Record<
  SongBlockKind,
  (durationSec: number) => BlockDef
> = {
  slowReference: (durationSec) => ({
    kind: "slowReference",
    label: "Slow Reference",
    durationSec,
    tempoFn: slowReferenceBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.slowReference,
  }),
  troubleSpot: (durationSec) => ({
    kind: "troubleSpot",
    label: "Trouble Spot",
    durationSec,
    tempoFn: (s) => troubleBlockBpmFor(s, 0),
    showEarnedButton: true,
    promotes: { kind: "trouble", index: 0 },
    instructions: INSTRUCTIONS.troubleSpot,
  }),
  ceilingWork: (durationSec) => ({
    kind: "ceilingWork",
    label: "Ceiling Work",
    durationSec,
    tempoFn: targetBpm,
    showEarnedButton: true,
    promotes: { kind: "working" },
    instructions: INSTRUCTIONS.ceilingWork,
  }),
  overspeed: (durationSec) => ({
    kind: "overspeed",
    label: "Overspeed",
    durationSec,
    tempoFn: overspeedBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.overspeed,
  }),
  consolidation: (durationSec) => ({
    kind: "consolidation",
    label: "Consolidation",
    durationSec,
    tempoFn: consolidationBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.consolidation,
  }),
};

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
): SongBlockTemplateEntry[] =>
  template.filter(
    (e) =>
      e.enabled &&
      e.weight > 0 &&
      (e.kind !== "troubleSpot" || troubleCount > 0),
  );

/**
 * Smart-mode body length: total seconds across all timed blocks (excludes
 * the unbounded Conscious Practice prefix). Always exactly `minutes * 60`
 * when the template has at least one active row.
 */
export const sessionLengthSec = (minutes: number, song: Song): number => {
  if (song.practiceMode === "simple") return minutes * 60;
  const entries = activeEntries(songTemplate(song), song.troubleSpots.length);
  if (entries.length === 0) return 0;
  return minutes * 60;
};

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
export const buildBlocks = (minutes: number, song: Song): BlockDef[] => {
  const result: BlockDef[] = [];
  if (wantsWarmup(song)) result.push(CONSCIOUS_PRACTICE_BLOCK);

  if (song.practiceMode === "simple") {
    result.push(buildSimpleMetronomeBlock(minutes * 60));
    return result;
  }

  const template = songTemplate(song);
  const troubleCount = song.troubleSpots.length;
  const entries = activeEntries(template, troubleCount);
  if (entries.length === 0) return result;

  const totalSec = minutes * 60;
  const totalWeight = entries.reduce((a, e) => a + e.weight, 0);

  // Allocate seconds per entry by floor; absorb residual into ceilingWork
  // (or first entry if ceilingWork isn't enabled).
  const allocs = entries.map((e) => ({
    entry: e,
    secs: Math.floor((e.weight / totalWeight) * totalSec),
  }));
  const allocatedSum = allocs.reduce((a, x) => a + x.secs, 0);
  let residual = totalSec - allocatedSum;
  if (residual !== 0) {
    const ceilingIdx = allocs.findIndex((a) => a.entry.kind === "ceilingWork");
    const idx = ceilingIdx >= 0 ? ceilingIdx : 0;
    allocs[idx].secs += residual;
    residual = 0;
  }

  for (const { entry, secs } of allocs) {
    if (entry.kind === "troubleSpot") {
      const per = Math.floor(secs / troubleCount);
      const spotResidual = secs - per * troubleCount;
      for (let i = 0; i < troubleCount; i++) {
        result.push({
          kind: "troubleSpot",
          label: troubleCount > 1 ? `Trouble Spot ${i + 1}` : "Trouble Spot",
          durationSec: per + (i === 0 ? spotResidual : 0),
          tempoFn: (s: Song) => troubleBlockBpmFor(s, i),
          showEarnedButton: true,
          promotes: { kind: "trouble", index: i },
          instructions: INSTRUCTIONS.troubleSpot,
        });
      }
    } else {
      result.push(SONG_BLOCK_FACTORIES[entry.kind](secs));
    }
  }

  return result;
};
