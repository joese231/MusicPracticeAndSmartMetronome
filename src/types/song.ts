export type TroubleSpot = {
  bpm: number | null;
};

/**
 * `smart`  — full three-tempo ladder (Slow Reference → Trouble Spots → Ceiling
 *            Work → Overspeed → Consolidation), promotions, trouble-spot
 *            blocks. The original/default behavior.
 * `simple` — single steady-BPM block at workingBpm for the whole session.
 *            Like a regular metronome with a stop timer. No promotions, no
 *            trouble-spot blocks.
 */
export type PracticeMode = "smart" | "simple";

/**
 * Kinds of timed blocks that can appear in a smart-mode song session.
 * Conscious Practice is *not* part of the template — it's an unbounded
 * warm-up prefix toggled by `includeWarmupBlock`.
 */
export type SongBlockKind =
  | "slowReference"
  | "troubleSpot"
  | "ceilingWork"
  | "overspeed"
  | "consolidation";

export type SongBlockTemplateEntry = {
  kind: SongBlockKind;
  enabled: boolean;
  /** Relative duration share. Positive integer; the block's allocated seconds
   * are computed as `(weight / totalEnabledWeight) * minutes * 60`. */
  weight: number;
};

/** Ordered list of timed-block entries — array order = play order. */
export type SongBlockTemplate = SongBlockTemplateEntry[];

export type Song = {
  id: string;
  title: string;
  link: string | null;
  workingBpm: number;
  /** Saved Conscious Practice BPM. null = use ⅓ × workingBpm rule (min 20). */
  warmupBpm: number | null;
  troubleSpots: TroubleSpot[];
  originalBpm: number | null;
  stepPercent: number;
  /** Which session shape to use. See {@link PracticeMode}. */
  practiceMode: PracticeMode;
  /** When false, the unbounded slow Conscious Practice warm-up block is
   * skipped and the session starts straight into the body. */
  includeWarmupBlock: boolean;
  /** Per-song timed-block sequence. Ignored in simple mode. Backfilled to
   * the default template on read for legacy rows that predate v9. */
  blockTemplate?: SongBlockTemplate;
  totalPracticeSec: number;
  /** User-controlled order in the practice list. Lower = higher in the list. */
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  recordingEnabled: boolean;
  metronomeVolume: number;
  accentsEnabled: boolean;
  /**
   * When false (the default), the session pauses between blocks and waits
   * for the player to press Space / tap Continue so they can finish the
   * current pass of the tune before moving on. When true, blocks flow into
   * each other automatically after a brief chime (the legacy behavior).
   */
  autoAdvanceBlocks: boolean;
  /**
   * Seconds to wait after a session completes before the next item in the
   * list auto-starts. Applies to both songs and exercises (the field name
   * is legacy from when only songs had the auto-advance flow). 0 disables
   * the pause — the next session starts immediately. Shown as a countdown
   * overlay with skip/cancel controls.
   */
  interSongPauseSec: number;
  /**
   * Initial practice mode applied when creating a new song or exercise. The
   * user can still flip the per-item setting afterward.
   */
  defaultPracticeMode: PracticeMode;
  /**
   * Seed template applied to new songs. Edit per-song afterwards. Saved on
   * the singleton settings row.
   */
  defaultSongBlockTemplate: SongBlockTemplate;
  /**
   * Seed template applied to new exercises. Same pattern as song template.
   */
  defaultExerciseBlockTemplate: ExerciseBlockTemplate;
};

/** Reference template that reproduces today's BASE_TEN_MIN_BLOCKS at 10 min. */
export const DEFAULT_SONG_BLOCK_TEMPLATE: SongBlockTemplate = [
  { kind: "slowReference", enabled: true, weight: 90 },
  { kind: "troubleSpot", enabled: true, weight: 120 },
  { kind: "ceilingWork", enabled: true, weight: 180 },
  { kind: "overspeed", enabled: true, weight: 60 },
  { kind: "consolidation", enabled: true, weight: 90 },
];

export const cloneSongTemplate = (t: SongBlockTemplate): SongBlockTemplate =>
  t.map((e) => ({ ...e }));

/**
 * Normalize a stored template against the current SongBlockKind union.
 * Legacy "slowMusical" entries are folded into "consolidation" (the merged
 * 80%-of-working block). If both kinds appear, weights sum and `enabled`
 * ORs. An empty / missing template returns a clone of the default.
 */
export function migrateSongTemplate(
  t: SongBlockTemplate | undefined | null,
): SongBlockTemplate {
  if (!Array.isArray(t) || t.length === 0) {
    return cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE);
  }
  const out: SongBlockTemplateEntry[] = [];
  let merged: SongBlockTemplateEntry | null = null;
  for (const entry of t) {
    const rawKind = (entry as { kind: string }).kind;
    const kind: SongBlockKind =
      rawKind === "slowMusical" ? "consolidation" : (rawKind as SongBlockKind);
    if (kind === "consolidation") {
      if (merged) {
        merged.weight += entry.weight;
        merged.enabled = merged.enabled || entry.enabled;
        continue;
      }
      merged = { kind: "consolidation", enabled: entry.enabled, weight: entry.weight };
      out.push(merged);
      continue;
    }
    out.push({ kind, enabled: entry.enabled, weight: entry.weight });
  }
  return out;
}

export const SONG_BLOCK_LABELS: Record<SongBlockKind, string> = {
  slowReference: "Slow Reference",
  troubleSpot: "Trouble Spot",
  ceilingWork: "Ceiling Work",
  overspeed: "Overspeed",
  consolidation: "Consolidation",
};

/** Short BPM-source hint for the editor UI. */
export const SONG_BLOCK_TEMPO_HINT: Record<SongBlockKind, string> = {
  slowReference: "@ slow reference (~80% working)",
  troubleSpot: "@ each trouble spot's saved BPM",
  ceilingWork: "@ target BPM (working × step)",
  overspeed: "@ overspeed (target × step)",
  consolidation: "@ ~70% working",
};

// ---- Exercise template types (mirror the song shape) ---------------------

export type ExerciseBlockKind = "exerciseBuild" | "exerciseBurst" | "exerciseCoolDown";

export type ExerciseBlockTemplateEntry = {
  kind: ExerciseBlockKind;
  enabled: boolean;
  weight: number;
};

export type ExerciseBlockTemplate = ExerciseBlockTemplateEntry[];

/** Reproduces today's 5-min default: Build 180s, Burst 90s, Cool Down 30s. */
export const DEFAULT_EXERCISE_BLOCK_TEMPLATE: ExerciseBlockTemplate = [
  { kind: "exerciseBuild", enabled: true, weight: 180 },
  { kind: "exerciseBurst", enabled: true, weight: 90 },
  { kind: "exerciseCoolDown", enabled: true, weight: 30 },
];

export const cloneExerciseTemplate = (
  t: ExerciseBlockTemplate,
): ExerciseBlockTemplate => t.map((e) => ({ ...e }));

export const EXERCISE_BLOCK_LABELS: Record<ExerciseBlockKind, string> = {
  exerciseBuild: "Build",
  exerciseBurst: "Burst",
  exerciseCoolDown: "Cool Down",
};

export const EXERCISE_BLOCK_TEMPO_HINT: Record<ExerciseBlockKind, string> = {
  exerciseBuild: "@ working BPM",
  exerciseBurst: "@ overspeed (working × step × step)",
  exerciseCoolDown: "@ slow reference (~80% working)",
};

export const DEFAULT_SETTINGS: Settings = {
  recordingEnabled: true,
  metronomeVolume: 0.8,
  accentsEnabled: true,
  autoAdvanceBlocks: false,
  interSongPauseSec: 20,
  defaultPracticeMode: "smart",
  defaultSongBlockTemplate: cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE),
  defaultExerciseBlockTemplate: cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE),
};

export const DEFAULT_STEP_PERCENT = 2.5;

export const DEFAULT_PRACTICE_MODE: PracticeMode = "smart";
export const DEFAULT_INCLUDE_WARMUP = true;

export const MAX_TROUBLE_SPOTS = 5;
