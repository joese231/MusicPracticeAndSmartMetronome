"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { CalendarHeatmap } from "@/components/stats/CalendarHeatmap";
import { PracticeMinutesChart } from "@/components/stats/PracticeMinutesChart";
import { PromotionVelocityTable } from "@/components/stats/PromotionVelocityTable";
import { RecentSessionsList } from "@/components/stats/RecentSessionsList";
import {
  totalPracticeMinutes,
  currentStreakDays,
} from "@/lib/stats/aggregate";
import { formatPracticeTime } from "@/lib/format";

export default function StatsPage() {
  const songs = useSongsStore((s) => s.songs);
  const songsLoaded = useSongsStore((s) => s.loaded);
  const loadSongs = useSongsStore((s) => s.load);

  const exercises = useExercisesStore((s) => s.exercises);
  const exercisesLoaded = useExercisesStore((s) => s.loaded);
  const loadExercises = useExercisesStore((s) => s.load);

  const records = useSessionHistoryStore((s) => s.records);
  const historyLoaded = useSessionHistoryStore((s) => s.loaded);
  const loadHistory = useSessionHistoryStore((s) => s.load);

  useEffect(() => {
    if (!songsLoaded) void loadSongs();
    if (!exercisesLoaded) void loadExercises();
    if (!historyLoaded) void loadHistory();
  }, [
    songsLoaded,
    loadSongs,
    exercisesLoaded,
    loadExercises,
    historyLoaded,
    loadHistory,
  ]);

  const allLoaded = songsLoaded && exercisesLoaded && historyLoaded;
  const totalMinutes = totalPracticeMinutes(records);
  const totalSec = Math.round(totalMinutes * 60);
  const streak = currentStreakDays(records);
  const totalPromotions = records.reduce((n, r) => n + r.promotions.length, 0);

  // Today's sessions — anything that started since local midnight.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysRecords = records.filter(
    (r) => new Date(r.startedAt) >= todayStart,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
        <nav className="flex items-center gap-5 text-sm text-neutral-400">
          <Link href="/" className="transition hover:text-neutral-100">
            Home
          </Link>
          <Link href="/method" className="transition hover:text-neutral-100">
            Method
          </Link>
          <Link href="/settings" className="transition hover:text-neutral-100">
            Settings
          </Link>
        </nav>
      </header>

      {!allLoaded ? (
        <p className="text-neutral-500">Loading…</p>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bg-border bg-bg-elevated/50 p-10 text-center">
          <h3 className="text-xl font-semibold text-neutral-200">No sessions yet</h3>
          <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
            Stats start filling in as soon as you finish your first session. Pick
            a song or exercise from the home screen and run a quick session.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total practice" value={formatPracticeTime(totalSec)} />
            <Stat label="Sessions" value={records.length.toString()} />
            <Stat label="Promotions" value={totalPromotions.toString()} />
            <Stat label="Current streak" value={`${streak}d`} />
          </section>

          {todaysRecords.length > 0 && (
            <RecentSessionsList
              records={todaysRecords}
              limit={20}
              heading="Today's sessions"
              showItemTitle
            />
          )}

          <CalendarHeatmap records={records} weeks={26} />

          <PracticeMinutesChart records={records} days={30} />

          <PromotionVelocityTable
            records={records}
            songs={songs}
            exercises={exercises}
          />

          <RecentSessionsList
            records={records}
            limit={20}
            heading="Recent sessions (all)"
            showItemTitle
          />
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div>
    </div>
  );
}
