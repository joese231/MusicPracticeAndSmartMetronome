"use client";
import { useState } from "react";
import type { SessionRecord } from "@/types/sessionRecord";
import { formatPracticeTime } from "@/lib/format";
import { SessionEditModal } from "./SessionEditModal";

type Props = {
  records: SessionRecord[];
  limit?: number;
  /** Override the heading. Defaults to "Recent sessions". */
  heading?: string;
  /** Show the item title on each row (useful on the global stats page where
   * sessions span multiple songs/exercises). */
  showItemTitle?: boolean;
};

export function RecentSessionsList({
  records,
  limit = 10,
  heading = "Recent sessions",
  showItemTitle = false,
}: Props) {
  const [editing, setEditing] = useState<SessionRecord | null>(null);
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  const shown = sorted.slice(0, limit);
  return (
    <>
      <div className="rounded-lg border border-bg-border bg-bg-elevated p-4">
        <div className="mb-3 text-sm font-semibold text-neutral-300">
          {heading}
        </div>
        <ul className="divide-y divide-bg-border text-sm">
          {shown.map((r) => {
            const d = new Date(r.startedAt);
            const date = d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            const time = d.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            });
            const promoCount = r.promotions.length;
            const bpmDelta =
              r.endWorkingBpm !== r.startWorkingBpm
                ? `${r.startWorkingBpm} → ${r.endWorkingBpm}`
                : `${r.endWorkingBpm}`;
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0 text-neutral-300">
                  <span className="font-medium">{date}</span>
                  <span className="ml-2 text-neutral-500">{time}</span>
                  {showItemTitle && (
                    <span className="ml-2 truncate text-neutral-400">
                      · {r.itemTitle}
                    </span>
                  )}
                  {r.endedReason === "abort" && (
                    <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
                      ended early
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  <span>{formatPracticeTime(r.durationSec)}</span>
                  <span className="font-mono tabular-nums text-neutral-300">
                    {bpmDelta} BPM
                  </span>
                  <span className={promoCount > 0 ? "text-accent" : ""}>
                    {promoCount} {promoCount === 1 ? "promotion" : "promotions"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    className="rounded border border-bg-border px-2 py-1 text-[11px] text-neutral-300 transition hover:border-accent hover:text-neutral-100"
                  >
                    Edit
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <SessionEditModal record={editing} onClose={() => setEditing(null)} />
    </>
  );
}
