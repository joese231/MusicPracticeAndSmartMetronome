import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";

export type BpmTimelinePoint = {
  at: string;
  workingBpm: number;
  troubleBpms: (number | null)[];
};

export type PromotionVelocity = {
  count: number;
  avgDaysBetween: number | null;
  lastAt: string | null;
};

const MS_PER_DAY = 86_400_000;

function dayKey(iso: string): string {
  // yyyy-mm-dd in local time so day boundaries match the user's wall clock.
  const d = new Date(iso);
  const yyyy = d.getFullYear().toString().padStart(4, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function byDayMinutes(records: SessionRecord[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of records) {
    const key = dayKey(r.startedAt);
    const minutes = r.durationSec / 60;
    out.set(key, (out.get(key) ?? 0) + minutes);
  }
  return out;
}

export function bpmTimeline(
  records: SessionRecord[],
  itemId: string,
): BpmTimelinePoint[] {
  const filtered = records
    .filter((r) => r.itemId === itemId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const out: BpmTimelinePoint[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    if (i === 0 && r.startWorkingBpm !== undefined) {
      out.push({
        at: r.startedAt,
        workingBpm: r.startWorkingBpm,
        troubleBpms: r.startTroubleBpms,
      });
    }
    if (r.endWorkingBpm !== undefined) {
      out.push({
        at: r.endedAt,
        workingBpm: r.endWorkingBpm,
        troubleBpms: r.endTroubleBpms,
      });
    }
  }
  return out;
}

export function promotionVelocity(
  records: SessionRecord[],
  itemId: string,
): PromotionVelocity {
  const promoTimes: number[] = [];
  for (const r of records) {
    if (r.itemId !== itemId) continue;
    for (const p of r.promotions) {
      promoTimes.push(new Date(p.at).getTime());
    }
  }
  if (promoTimes.length === 0) {
    return { count: 0, avgDaysBetween: null, lastAt: null };
  }
  promoTimes.sort((a, b) => a - b);
  let avgDaysBetween: number | null = null;
  if (promoTimes.length >= 2) {
    const span = promoTimes[promoTimes.length - 1] - promoTimes[0];
    avgDaysBetween = span / MS_PER_DAY / (promoTimes.length - 1);
  }
  return {
    count: promoTimes.length,
    avgDaysBetween,
    lastAt: new Date(promoTimes[promoTimes.length - 1]).toISOString(),
  };
}

export function stalledSongs(
  records: SessionRecord[],
  songs: Song[],
  sinceDays = 14,
  now: Date = new Date(),
): Song[] {
  const cutoff = now.getTime() - sinceDays * MS_PER_DAY;
  const lastPromoByItem = new Map<string, number>();
  for (const r of records) {
    for (const p of r.promotions) {
      const t = new Date(p.at).getTime();
      const prev = lastPromoByItem.get(r.itemId) ?? 0;
      if (t > prev) lastPromoByItem.set(r.itemId, t);
    }
  }
  return songs.filter((s) => {
    const last = lastPromoByItem.get(s.id) ?? 0;
    return last < cutoff;
  });
}

export function totalPracticeMinutes(records: SessionRecord[]): number {
  let secs = 0;
  for (const r of records) secs += r.durationSec;
  return secs / 60;
}

export function currentStreakDays(
  records: SessionRecord[],
  now: Date = new Date(),
): number {
  if (records.length === 0) return 0;
  const days = byDayMinutes(records);
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // If today has no practice, the streak still extends back through yesterday.
  if (!days.has(formatDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(formatDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatDay(d: Date): string {
  const yyyy = d.getFullYear().toString().padStart(4, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
