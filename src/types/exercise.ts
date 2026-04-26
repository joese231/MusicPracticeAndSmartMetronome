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
   * extra time beyond the fixed 90s Burst + 30s Cool Down. */
  sessionMinutes: number;
  totalPracticeSec: number;
  /** User-controlled order in the exercise list. Lower = higher in the list. */
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};
