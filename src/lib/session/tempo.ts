import type { Song } from "@/types/song";

export const nowIso = () => new Date().toISOString();

export const step = (bpm: number, stepPercent: number): number => {
  // Computed with integer scaling to avoid float rounding bugs where
  // e.g. 220 * 1.025 === 225.49999999999997 and rounds down to 225.
  const scale = 1_000_000;
  const factor = scale + Math.round(stepPercent * 10_000);
  return Math.round((bpm * factor) / scale);
};

export const targetBpm = (s: Song): number => step(s.workingBpm, s.stepPercent);

export const overspeedBpm = (s: Song): number => step(targetBpm(s), s.stepPercent);

/**
 * Conscious Practice warm-up BPM. Uses the song's saved `warmupBpm` if set;
 * otherwise falls back to ⅓ × workingBpm, floored at 20. Single source of
 * truth for both the tempoFn and any UI that needs the default value.
 */
export const warmupBpmFor = (s: Song): number =>
  s.warmupBpm ?? Math.max(20, Math.round(s.workingBpm / 3));

export const slowReferenceBpm = (s: Song): number => Math.round(s.workingBpm * 0.8);

export const consolidationBpm = (s: Song): number => Math.round(s.workingBpm * 0.7);

export const fiveMinSlowReferenceBpm = (s: Song): number =>
  Math.round(s.workingBpm * 0.8);

export const troubleBlockBpmFor = (s: Song, index: number): number =>
  s.troubleSpots[index]?.bpm ?? slowReferenceBpm(s);

export const promoteWorking = (s: Song): Song => ({
  ...s,
  workingBpm: step(s.workingBpm, s.stepPercent),
  updatedAt: nowIso(),
});

export const promoteTroubleAt = (s: Song, index: number): Song => {
  const spot = s.troubleSpots[index];
  if (!spot || spot.bpm == null) return s;
  const stepped = step(spot.bpm, s.stepPercent);
  const nextSpots = s.troubleSpots.map((ts, i) =>
    i === index ? { ...ts, bpm: stepped } : ts,
  );
  return {
    ...s,
    troubleSpots: nextSpots,
    updatedAt: nowIso(),
  };
};
