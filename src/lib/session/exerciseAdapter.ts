import type { Exercise } from "@/types/exercise";
import type { Song } from "@/types/song";

/**
 * Wrap an Exercise as a Song-shaped object so the existing driver, tempo
 * helpers, and BlockDef.tempoFn (which all take a Song) work unchanged. The
 * returned object has no trouble spots and no originalBpm — the exercise
 * session only ever promotes workingBpm.
 */
export const exerciseAsSong = (e: Exercise): Song => ({
  id: e.id,
  title: e.name,
  link: e.link,
  workingBpm: e.workingBpm,
  warmupBpm: e.warmupBpm,
  troubleSpots: [],
  originalBpm: null,
  stepPercent: e.stepPercent,
  totalPracticeSec: e.totalPracticeSec,
  sortIndex: e.sortIndex,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});
