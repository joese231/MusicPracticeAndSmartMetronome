export type TroubleSpot = {
  bpm: number | null;
};

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
};

export const DEFAULT_SETTINGS: Settings = {
  recordingEnabled: true,
  metronomeVolume: 0.8,
  accentsEnabled: true,
  autoAdvanceBlocks: false,
  interSongPauseSec: 20,
};

export const DEFAULT_STEP_PERCENT = 2.5;

export const MAX_TROUBLE_SPOTS = 5;
