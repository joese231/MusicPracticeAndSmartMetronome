import type { PracticeMode } from "./song";

export type Exercise = {
  id: string;
  name: string;
  link: string | null;
  notes: string | null;
  workingBpm: number;
  /** Saved Conscious Practice BPM. null = use ⅓ × workingBpm rule (min 20). */
  warmupBpm: number | null;
  stepPercent: number;
  /** Total session length in minutes (5..60). The Build block absorbs all
   * extra time beyond the fixed 90s Burst + 30s Cool Down. Ignored when
   * `openEnded` is true. */
  sessionMinutes: number;
  /** When true, the session runs as a single unbounded count-up timer at
   * `workingBpm` — no warm-up, no Build/Burst/Cool Down. Use for transcribing,
   * free-form noodling, or any practice activity that isn't a structured drill.
   * Takes precedence over `practiceMode` and `includeWarmupBlock` — when
   * true, those are ignored. */
  openEnded: boolean;
  /** When false, the session runs without the metronome ticking. Saved on
   * the exercise so the user doesn't re-toggle every session (e.g. transcribing
   * is typically without a click). */
  metronomeEnabled: boolean;
  /** Which session shape to use when `openEnded` is false. `smart` =
   * Build/Burst/Cool Down. `simple` = single steady-BPM block for the full
   * `sessionMinutes`. Ignored when `openEnded` is true. */
  practiceMode: PracticeMode;
  /** When false, the slow Conscious Practice warm-up block is skipped.
   * Ignored when `openEnded` is true. */
  includeWarmupBlock: boolean;
  totalPracticeSec: number;
  /** User-controlled order in the exercise list. Lower = higher in the list. */
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};
