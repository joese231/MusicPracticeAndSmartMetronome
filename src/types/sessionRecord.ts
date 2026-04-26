export type PromotionEvent = {
  at: string;
  kind: "working" | "trouble";
  troubleIndex?: number;
  fromBpm: number;
  toBpm: number;
  stepPercent: number;
};

export type SessionRecord = {
  id: string;
  itemId: string;
  itemKind: "song" | "exercise";
  itemTitle: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  endedReason: "complete" | "abort";
  plannedMinutes: number;
  startWorkingBpm: number;
  endWorkingBpm: number;
  startTroubleBpms: (number | null)[];
  endTroubleBpms: (number | null)[];
  promotions: PromotionEvent[];
};
