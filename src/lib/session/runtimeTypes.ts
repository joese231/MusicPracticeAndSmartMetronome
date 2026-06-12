import type { TroubleSpot } from "@/types/song";

export type TempoSubject = {
  workingBpm: number | null;
  warmupBpm: number | null;
  troubleSpots: TroubleSpot[];
  originalBpm: number | null;
  stepPercent: number;
};
