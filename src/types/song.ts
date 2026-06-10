export type TroubleSpot = {
  bpm: number | null;
};

/**
 * `smart`  — configurable block recipe sequence with tempo rules,
 *            promotions, and trouble-spot expansion.
 * `simple` — single steady-BPM block at workingBpm for the whole session.
 *            Like a regular metronome with a stop timer. No promotions, no
 *            trouble-spot blocks.
 * `timed`  — single countdown block, optionally without metronome. Useful
 *            when learning a new song before a working BPM exists.
 * `openEnded` — single count-up block, optionally without metronome.
 */
export type PracticeMode = "smart" | "simple" | "timed" | "openEnded";

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

export type SmartBlockRole =
  | SongBlockKind
  | "exerciseBuild"
  | "exerciseBurst"
  | "exerciseCoolDown"
  | "custom";

export type BlockDurationRule =
  | { kind: "fixed"; seconds: number }
  | { kind: "percent"; percent: number };

export type TempoAdjustment =
  | { kind: "percent"; value: number }
  | { kind: "bpmOffset"; value: number }
  | { kind: "steps"; value: number };

export type TempoRule =
  | { source: "working"; adjustment?: TempoAdjustment }
  | { source: "target"; adjustment?: TempoAdjustment }
  | { source: "overspeed"; adjustment?: TempoAdjustment }
  | { source: "original"; adjustment?: TempoAdjustment; fallback: TempoRule }
  | { source: "trouble"; adjustment?: TempoAdjustment; fallback: TempoRule }
  | { source: "fixed"; bpm: number };

export type ProgressionRule =
  | { kind: "none" }
  | { kind: "working" }
  | { kind: "trouble" };

export type SmartBlockRecipe = {
  id: string;
  role: SmartBlockRole;
  name: string;
  purpose: string;
  instructions: string[];
  enabled: boolean;
  duration: BlockDurationRule;
  tempoRule: TempoRule;
  metronomeEnabled: boolean;
  progression: ProgressionRule;
};

/** Ordered list of timed-block recipes — array order = play order. */
export type SongBlockTemplate = SmartBlockRecipe[];

export type Song = {
  id: string;
  title: string;
  link: string | null;
  workingBpm: number | null;
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
  /** Saved session length for timed runs. Existing songs default to 10. */
  defaultSessionMinutes: number;
  /** Used by timed/open-ended song modes. Smart/simple keep the metronome on. */
  metronomeEnabled: boolean;
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
  defaultSongSessionMinutes: number;
  defaultExerciseSessionMinutes: number;
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

export const SONG_BLOCK_LABELS: Record<SongBlockKind, string> = {
  slowReference: "Slow Reference",
  troubleSpot: "Trouble Spot",
  ceilingWork: "Ceiling Work",
  overspeed: "Overspeed",
  consolidation: "Consolidation",
};

/** Short BPM-source hint for the editor UI. */
export const SONG_BLOCK_TEMPO_HINT: Record<SongBlockKind, string> = {
  slowReference: "@ 80% working",
  troubleSpot: "@ saved trouble BPM, else 80% working",
  ceilingWork: "@ target BPM (working + 1 step)",
  overspeed: "@ overspeed (working + 2 steps)",
  consolidation: "@ 70% working",
};

// ---- Exercise template types (mirror the song shape) ---------------------

export type ExerciseBlockKind = "exerciseBuild" | "exerciseBurst" | "exerciseCoolDown";

export const EXERCISE_BLOCK_LABELS: Record<ExerciseBlockKind, string> = {
  exerciseBuild: "Build",
  exerciseBurst: "Burst",
  exerciseCoolDown: "Cool Down",
};

export const EXERCISE_BLOCK_TEMPO_HINT: Record<ExerciseBlockKind, string> = {
  exerciseBuild: "@ working BPM",
  exerciseBurst: "@ overspeed (working + 2 steps)",
  exerciseCoolDown: "@ 80% working",
};

const DEFAULT_SONG_INSTRUCTIONS: Record<SongBlockKind, string[]> = {
  slowReference: [
    "Play the full tune slowly and relaxed.",
    "Stay here until you can play one clean-enough repetition of the song.",
  ],
  troubleSpot: [
    "Loop just the hardest 1-2 bars of the tune.",
    "Three clean-and-relaxed reps earns the next rung.",
  ],
  ceilingWork: [
    "Full tune at the target tempo.",
    "Three clean-and-relaxed reps earns a new working tempo.",
  ],
  overspeed: [
    "Play at least one repetition above your target tempo.",
    "Messy is OK; the goal is to make target feel slower.",
  ],
  consolidation: [
    "Play relaxed reps below working tempo.",
    "Stay here until you can play one very relaxed musical pass.",
  ],
};

const DEFAULT_EXERCISE_INSTRUCTIONS: Record<ExerciseBlockKind, string[]> = {
  exerciseBuild: [
    "Working tempo - internalize the motion cleanly.",
    "Three clean-and-relaxed reps earns a new working tempo.",
  ],
  exerciseBurst: [
    "Short burst above working tempo.",
    "Push speed without trying to earn anything here.",
  ],
  exerciseCoolDown: [
    "Slow and relaxed - release tension from the burst.",
    "End with clean reps.",
  ],
};

const songRecipe = (
  role: SongBlockKind,
  duration: BlockDurationRule,
  tempoRule: TempoRule,
  progression: ProgressionRule = { kind: "none" },
): SmartBlockRecipe => ({
  id: `song-${role}`,
  role,
  name: SONG_BLOCK_LABELS[role],
  purpose: SONG_BLOCK_TEMPO_HINT[role],
  instructions: DEFAULT_SONG_INSTRUCTIONS[role],
  enabled: true,
  duration,
  tempoRule,
  metronomeEnabled: true,
  progression,
});

/** Default 10-min base: 1:30 slow, 3:45 ceiling, 1:15 overspeed, 3:30 consolidation.
 * Trouble spots are additive: each spot adds a fixed 2-minute block. */
export const DEFAULT_SONG_BLOCK_TEMPLATE: SongBlockTemplate = [
  songRecipe(
    "slowReference",
    { kind: "fixed", seconds: 90 },
    {
      source: "working",
      adjustment: { kind: "percent", value: 80 },
    },
  ),
  songRecipe(
    "troubleSpot",
    { kind: "fixed", seconds: 120 },
    {
      source: "trouble",
      fallback: {
        source: "working",
        adjustment: { kind: "percent", value: 80 },
      },
    },
    { kind: "trouble" },
  ),
  songRecipe(
    "ceilingWork",
    { kind: "percent", percent: 44.12 },
    { source: "working", adjustment: { kind: "steps", value: 1 } },
    { kind: "working" },
  ),
  songRecipe("overspeed", { kind: "percent", percent: 14.71 }, {
    source: "working",
    adjustment: { kind: "steps", value: 2 },
  }),
  songRecipe("consolidation", { kind: "percent", percent: 41.17 }, {
    source: "working",
    adjustment: { kind: "percent", value: 70 },
  }),
];

export const cloneSongTemplate = (t: SongBlockTemplate): SongBlockTemplate =>
  t.map((e) => ({
    ...e,
    instructions: e.instructions.slice(),
    duration: { ...e.duration },
    tempoRule: cloneTempoRule(e.tempoRule),
    progression: { ...e.progression },
  }));

function cloneTempoRule(rule: TempoRule): TempoRule {
  if (rule.source === "fixed") return { ...rule };
  if (rule.source === "original" || rule.source === "trouble") {
    return {
      ...rule,
      adjustment: rule.adjustment ? { ...rule.adjustment } : undefined,
      fallback: cloneTempoRule(rule.fallback),
    };
  }
  return {
    ...rule,
    adjustment: rule.adjustment ? { ...rule.adjustment } : undefined,
  };
}

type LegacySongBlockTemplateEntry = {
  kind: SongBlockKind | "slowMusical";
  enabled: boolean;
  weight: number;
};

type LegacySongBlockTemplate = LegacySongBlockTemplateEntry[];

type LegacyExerciseBlockTemplateEntry = {
  kind: ExerciseBlockKind;
  enabled: boolean;
  weight: number;
};

type LegacyExerciseBlockTemplate = LegacyExerciseBlockTemplateEntry[];

function isRecipeTemplate(
  t: SongBlockTemplate | ExerciseBlockTemplate | LegacySongBlockTemplate | LegacyExerciseBlockTemplate,
): t is SongBlockTemplate | ExerciseBlockTemplate {
  return t.every((entry) => "role" in entry && "duration" in entry);
}

function durationPercent(rule: BlockDurationRule): number {
  return rule.kind === "percent" ? Math.max(0, rule.percent) : Math.max(0, rule.seconds);
}

function normalizeRecipe(
  entry: Partial<SmartBlockRecipe>,
  fallbackId: string,
): SmartBlockRecipe {
  const role = entry.role ?? "custom";
  const isSongRole = isSongBlockRole(role);
  const isExerciseRole = isExerciseBlockRole(role);
  const defaultName = isSongRole
    ? SONG_BLOCK_LABELS[role]
    : isExerciseRole
      ? EXERCISE_BLOCK_LABELS[role]
      : "Custom Block";
  const defaultHint = isSongRole
    ? SONG_BLOCK_TEMPO_HINT[role]
    : isExerciseRole
      ? EXERCISE_BLOCK_TEMPO_HINT[role]
      : "Custom practice block";
  return {
    id: entry.id || fallbackId,
    role,
    name: entry.name || defaultName,
    purpose: entry.purpose || defaultHint,
    instructions: Array.isArray(entry.instructions)
      ? entry.instructions.slice()
      : [defaultHint],
    enabled: entry.enabled !== false,
    duration: entry.duration ? { ...entry.duration } : { kind: "percent", percent: 1 },
    tempoRule: entry.tempoRule ? cloneTempoRule(entry.tempoRule) : { source: "working" },
    metronomeEnabled: entry.metronomeEnabled !== false,
    progression: entry.progression ? { ...entry.progression } : { kind: "none" },
  };
}

function isSongBlockRole(role: SmartBlockRole): role is SongBlockKind {
  return (
    role === "slowReference" ||
    role === "troubleSpot" ||
    role === "ceilingWork" ||
    role === "overspeed" ||
    role === "consolidation"
  );
}

function isExerciseBlockRole(role: SmartBlockRole): role is ExerciseBlockKind {
  return (
    role === "exerciseBuild" ||
    role === "exerciseBurst" ||
    role === "exerciseCoolDown"
  );
}

function recipeFromLegacySongEntry(
  kind: SongBlockKind,
  enabled: boolean,
  weight: number,
): SmartBlockRecipe {
  const template = songRecipe(
    kind,
    { kind: "percent", percent: Math.max(0, weight) },
    defaultSongTempoRule(kind),
    defaultSongProgression(kind),
  );
  return { ...template, enabled };
}

function defaultSongTempoRule(kind: SongBlockKind): TempoRule {
  switch (kind) {
    case "slowReference":
      return { source: "working", adjustment: { kind: "percent", value: 80 } };
    case "troubleSpot":
      return {
        source: "trouble",
        fallback: {
          source: "working",
          adjustment: { kind: "percent", value: 80 },
        },
      };
    case "ceilingWork":
      return { source: "working", adjustment: { kind: "steps", value: 1 } };
    case "overspeed":
      return { source: "working", adjustment: { kind: "steps", value: 2 } };
    case "consolidation":
      return { source: "working", adjustment: { kind: "percent", value: 70 } };
  }
}

function defaultSongProgression(kind: SongBlockKind): ProgressionRule {
  if (kind === "ceilingWork") return { kind: "working" };
  if (kind === "troubleSpot") return { kind: "trouble" };
  return { kind: "none" };
}

function recipeFromLegacyExerciseEntry(
  kind: ExerciseBlockKind,
  enabled: boolean,
  weight: number,
): SmartBlockRecipe {
  const template = exerciseRecipe(
    kind,
    Math.max(0, weight),
    defaultExerciseTempoRule(kind),
    kind === "exerciseBuild" ? { kind: "working" } : { kind: "none" },
  );
  return { ...template, enabled };
}

function defaultExerciseTempoRule(kind: ExerciseBlockKind): TempoRule {
  switch (kind) {
    case "exerciseBuild":
      return { source: "working" };
    case "exerciseBurst":
      return { source: "working", adjustment: { kind: "steps", value: 2 } };
    case "exerciseCoolDown":
      return { source: "working", adjustment: { kind: "percent", value: 80 } };
  }
}

/**
 * Normalize a stored template against the current SongBlockKind union.
 * Legacy "slowMusical" entries are folded into "consolidation" (the merged
 * 80%-of-working block). If both kinds appear, weights sum and `enabled`
 * ORs. An empty / missing template returns a clone of the default.
 */
export function migrateSongTemplate(
  t: SongBlockTemplate | LegacySongBlockTemplate | undefined | null,
): SongBlockTemplate {
  if (!Array.isArray(t) || t.length === 0) {
    return cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE);
  }
  if (isRecipeTemplate(t)) {
    return t.map((entry, i) => normalizeRecipe(entry, `song-custom-${i}`));
  }
  const out: SmartBlockRecipe[] = [];
  let merged: SmartBlockRecipe | null = null;
  for (const entry of t) {
    const rawKind = (entry as { kind: string }).kind;
    const kind: SongBlockKind =
      rawKind === "slowMusical" ? "consolidation" : (rawKind as SongBlockKind);
    const recipe = recipeFromLegacySongEntry(kind, entry.enabled, entry.weight);
    if (kind === "consolidation") {
      if (merged) {
        merged.duration = {
          kind: "percent",
          percent:
            durationPercent(merged.duration) + Math.max(0, entry.weight),
        };
        merged.enabled = merged.enabled || entry.enabled;
        continue;
      }
      merged = recipe;
      out.push(merged);
      continue;
    }
    out.push(recipe);
  }
  return out;
}

export function migrateDefaultSongTemplate(
  t: SongBlockTemplate | LegacySongBlockTemplate | undefined | null,
): SongBlockTemplate {
  const migrated = migrateSongTemplate(t);
  return isLegacyCanonicalDefaultSongTemplate(migrated)
    ? cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE)
    : migrated;
}

function isLegacyCanonicalDefaultSongTemplate(t: SongBlockTemplate): boolean {
  const expected: Array<[SmartBlockRole, BlockDurationRule]> = [
    ["slowReference", { kind: "percent", percent: 90 }],
    ["troubleSpot", { kind: "percent", percent: 120 }],
    ["ceilingWork", { kind: "percent", percent: 180 }],
    ["overspeed", { kind: "percent", percent: 60 }],
    ["consolidation", { kind: "percent", percent: 90 }],
  ];
  if (t.length !== expected.length) return false;
  return expected.every(([role, duration], index) => {
    const entry = t[index];
    return (
      entry?.role === role &&
      entry.enabled === true &&
      durationsEqual(entry.duration, duration)
    );
  });
}

function durationsEqual(a: BlockDurationRule, b: BlockDurationRule): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "fixed" && b.kind === "fixed") return a.seconds === b.seconds;
  if (a.kind === "percent" && b.kind === "percent") {
    return a.percent === b.percent;
  }
  return false;
}

export type ExerciseBlockTemplate = SmartBlockRecipe[];

const exerciseRecipe = (
  role: ExerciseBlockKind,
  durationPercent: number,
  tempoRule: TempoRule,
  progression: ProgressionRule = { kind: "none" },
): SmartBlockRecipe => ({
  id: `exercise-${role}`,
  role,
  name: EXERCISE_BLOCK_LABELS[role],
  purpose: EXERCISE_BLOCK_TEMPO_HINT[role],
  instructions: DEFAULT_EXERCISE_INSTRUCTIONS[role],
  enabled: true,
  duration: { kind: "percent", percent: durationPercent },
  tempoRule,
  metronomeEnabled: true,
  progression,
});

/** 5-min default: Build 210s, Burst 60s, Cool Down 30s — sums to 300s. */
export const DEFAULT_EXERCISE_BLOCK_TEMPLATE: ExerciseBlockTemplate = [
  exerciseRecipe(
    "exerciseBuild",
    210,
    { source: "working" },
    { kind: "working" },
  ),
  exerciseRecipe("exerciseBurst", 60, {
    source: "working",
    adjustment: { kind: "steps", value: 2 },
  }),
  exerciseRecipe("exerciseCoolDown", 30, {
    source: "working",
    adjustment: { kind: "percent", value: 80 },
  }),
];

export const cloneExerciseTemplate = (
  t: ExerciseBlockTemplate,
): ExerciseBlockTemplate => cloneSongTemplate(t);

/**
 * Normalize a stored exercise template. Currently rewrites legacy `exerciseBurst`
 * weight 90 (old default) to 60 (new default). User-customized weights (any
 * value other than 90) are preserved. Idempotent. An empty / missing template
 * returns a clone of the default.
 */
export function migrateExerciseTemplate(
  t: ExerciseBlockTemplate | LegacyExerciseBlockTemplate | undefined | null,
): ExerciseBlockTemplate {
  if (!Array.isArray(t) || t.length === 0) {
    return cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE);
  }
  if (isRecipeTemplate(t)) {
    return t.map((entry, i) => normalizeRecipe(entry, `exercise-custom-${i}`));
  }
  return t.map((e) => {
    const weight = e.kind === "exerciseBurst" && e.weight === 90 ? 60 : e.weight;
    return recipeFromLegacyExerciseEntry(e.kind, e.enabled, weight);
  });
}

export const DEFAULT_SETTINGS: Settings = {
  recordingEnabled: true,
  metronomeVolume: 0.8,
  accentsEnabled: true,
  autoAdvanceBlocks: false,
  interSongPauseSec: 20,
  defaultPracticeMode: "smart",
  defaultSongSessionMinutes: 10,
  defaultExerciseSessionMinutes: 5,
  defaultSongBlockTemplate: cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE),
  defaultExerciseBlockTemplate: cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE),
};

export const DEFAULT_STEP_PERCENT = 2.5;

export const DEFAULT_PRACTICE_MODE: PracticeMode = "smart";
export const DEFAULT_INCLUDE_WARMUP = true;
export const DEFAULT_SONG_SESSION_MINUTES = 10;

export const MAX_TROUBLE_SPOTS = 5;
