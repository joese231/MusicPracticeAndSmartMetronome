export type TroubleSpot = {
  bpm: number | null;
};

/**
 * `smart`  — full three-tempo ladder (Slow Reference → Trouble Spots → Ceiling
 *            Work → Overspeed → Consolidation → Slow Musical), promotions,
 *            trouble-spot blocks. The original/default behavior.
 * `simple` — single steady-BPM block at workingBpm for the whole session.
 *            Like a regular metronome with a stop timer. No promotions, no
 *            trouble-spot blocks.
 */
export type PracticeMode = "smart" | "simple";

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
};

export const DEFAULT_SETTINGS: Settings = {
  recordingEnabled: true,
  metronomeVolume: 0.8,
  accentsEnabled: true,
  autoAdvanceBlocks: false,
  interSongPauseSec: 20,
  defaultPracticeMode: "smart",
};

export const DEFAULT_STEP_PERCENT = 2.5;

export const DEFAULT_PRACTICE_MODE: PracticeMode = "smart";
export const DEFAULT_INCLUDE_WARMUP = true;

export const MAX_TROUBLE_SPOTS = 5;
