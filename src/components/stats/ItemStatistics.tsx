"use client";

import Link from "next/link";
import type { SessionRecord } from "@/types/sessionRecord";
import { BpmTimelineChart } from "./BpmTimelineChart";
import { RecentSessionsList } from "./RecentSessionsList";

export function ItemStatistics({ title, itemId, records, loaded, troubleSpotCount = 0, onBack }: {
  title: string;
  itemId: string;
  records: SessionRecord[];
  loaded: boolean;
  troubleSpotCount?: number;
  onBack?: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" onClick={onBack} className="text-sm text-neutral-400 hover:text-neutral-100">← Back to practice</Link>
      <h1 className="mt-4 break-words text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-lg text-accent">Statistics</p>
      <div className="mt-6 space-y-4">
        {!loaded ? <p className="text-neutral-400">Loading statistics…</p> : <>
          <BpmTimelineChart records={records} itemId={itemId} troubleSpotCount={troubleSpotCount} />
          {records.length > 0 ? <RecentSessionsList records={records} limit={10} /> : (
            <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
              <h2 className="font-semibold">Recent sessions</h2>
              <p className="mt-2 text-sm text-neutral-400">No practice sessions recorded yet.</p>
            </section>
          )}
        </>}
      </div>
    </main>
  );
}
