"use client";
import Link from "next/link";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import { promotionVelocity } from "@/lib/stats/aggregate";

type Item = {
  id: string;
  title: string;
  href: string;
  workingBpm: number;
};

type Props = {
  records: SessionRecord[];
  songs: Song[];
  exercises: Exercise[];
  stalledThresholdDays?: number;
};

const MS_PER_DAY = 86_400_000;

export function PromotionVelocityTable({
  records,
  songs,
  exercises,
  stalledThresholdDays = 14,
}: Props) {
  const items: Item[] = [
    ...songs.map((s) => ({
      id: s.id,
      title: s.title,
      href: `/songs/${s.id}`,
      workingBpm: s.workingBpm,
    })),
    ...exercises.map((e) => ({
      id: e.id,
      title: e.name,
      href: `/exercises/${e.id}`,
      workingBpm: e.workingBpm,
    })),
  ];

  if (items.length === 0) return null;

  const now = Date.now();
  const rows = items
    .map((it) => {
      const v = promotionVelocity(records, it.id);
      const ageDays =
        v.lastAt != null ? (now - new Date(v.lastAt).getTime()) / MS_PER_DAY : null;
      const stalled =
        v.count === 0 || (ageDays != null && ageDays > stalledThresholdDays);
      return { it, v, ageDays, stalled };
    })
    .sort((a, b) => b.v.count - a.v.count);

  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated p-4">
      <div className="mb-3 text-sm font-semibold text-neutral-300">
        Promotion velocity
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3">Working</th>
              <th className="py-1 pr-3">Promotions</th>
              <th className="py-1 pr-3">Avg gap</th>
              <th className="py-1 pr-3">Last</th>
              <th className="py-1 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ it, v, ageDays, stalled }) => (
              <tr key={it.id} className="border-t border-bg-border">
                <td className="py-2 pr-3">
                  <Link href={it.href} className="text-accent hover:underline">
                    {it.title}
                  </Link>
                </td>
                <td className="py-2 pr-3 font-mono tabular-nums text-neutral-300">
                  {it.workingBpm}
                </td>
                <td className="py-2 pr-3 text-neutral-300">{v.count}</td>
                <td className="py-2 pr-3 text-neutral-400">
                  {v.avgDaysBetween != null
                    ? `${v.avgDaysBetween.toFixed(1)} d`
                    : "—"}
                </td>
                <td className="py-2 pr-3 text-neutral-400">
                  {ageDays != null ? `${Math.round(ageDays)} d ago` : "—"}
                </td>
                <td className="py-2 pr-3">
                  {stalled ? (
                    <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                      stalled
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400">active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
