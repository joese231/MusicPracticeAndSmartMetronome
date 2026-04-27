"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { LatestRecordingPanel } from "@/components/songs/LatestRecordingPanel";
import { BpmTimelineChart } from "@/components/stats/BpmTimelineChart";
import { RecentSessionsList } from "@/components/stats/RecentSessionsList";
import { formatPracticeTime } from "@/lib/format";
import { unlockSharedAudioContext } from "@/lib/metronome/scheduler";
import { overspeedBpm, slowReferenceBpm } from "@/lib/session/tempo";
import { exerciseAsSong } from "@/lib/session/exerciseAdapter";

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const loaded = useExercisesStore((s) => s.loaded);
  const load = useExercisesStore((s) => s.load);
  const exercise = useExercisesStore((s) => s.exercises.find((x) => x.id === id));
  const updateExercise = useExercisesStore((s) => s.updateExercise);
  const deleteExercise = useExercisesStore((s) => s.deleteExercise);

  const records = useSessionHistoryStore((s) => s.records);
  const historyLoaded = useSessionHistoryStore((s) => s.loaded);
  const loadHistory = useSessionHistoryStore((s) => s.load);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
    if (!historyLoaded) void loadHistory();
  }, [loaded, load, historyLoaded, loadHistory]);

  const exerciseRecords = useMemo(
    () => (id ? records.filter((r) => r.itemId === id) : []),
    [records, id],
  );

  if (!loaded) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-neutral-500">Loading...</main>
    );
  }

  if (!exercise) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Exercise not found</h1>
      </main>
    );
  }

  const songLike = exerciseAsSong(exercise);
  const burst = overspeedBpm(songLike);
  const cool = slowReferenceBpm(songLike);

  const handleStart = () => {
    unlockSharedAudioContext();
    router.push(`/exercise-session/${exercise.id}`);
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
        ← Back
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight">{exercise.name}</h1>
          {exercise.link && (
            <a
              href={exercise.link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-accent underline-offset-2 hover:underline"
            >
              Open link →
            </a>
          )}
        </div>
      </header>

      <div className="mt-6 space-y-4">
        <LatestRecordingPanel songId={exercise.id} />

        {exerciseRecords.length > 0 && (
          <>
            <BpmTimelineChart
              records={exerciseRecords}
              itemId={exercise.id}
              troubleSpotCount={0}
            />
            <RecentSessionsList records={exerciseRecords} limit={10} />
          </>
        )}

        <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <Stat label="Working" value={`${exercise.workingBpm} BPM`} highlight />
            {!exercise.openEnded && (
              <>
                <Stat label="Burst (overspeed)" value={`${burst} BPM`} />
                <Stat label="Cool down" value={`${cool} BPM`} />
                <Stat label="Length" value={`${exercise.sessionMinutes} min`} />
              </>
            )}
            <Stat label="Step" value={`${exercise.stepPercent}%`} />
            {exercise.openEnded && <Stat label="Mode" value="Open-ended" />}
            {!exercise.metronomeEnabled && <Stat label="Metronome" value="Off" />}
            <Stat label="Total practice" value={formatPracticeTime(exercise.totalPracticeSec)} />
          </div>
          {exercise.notes && (
            <div className="mt-4 whitespace-pre-wrap rounded-md border border-bg-border bg-bg/50 px-4 py-3 text-sm text-neutral-300">
              {exercise.notes}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
          <h2 className="text-lg font-semibold">Start session</h2>
          <p className="mt-2 text-xs text-neutral-500">
            {exercise.openEnded ? (
              <>
                Open-ended count-up timer at <span className="font-mono">{exercise.workingBpm}</span>{" "}
                BPM
                {exercise.metronomeEnabled ? "" : " (metronome off)"}. Press{" "}
                <span className="font-mono">Esc</span> when you&apos;re done.
              </>
            ) : (
              <>
                Conscious Practice warm-up (you end it when ready), then{" "}
                {formatBuildDuration(exercise.sessionMinutes)} Build · 1.5 min Burst · 30 sec Cool Down. Press{" "}
                <span className="font-mono">+</span> in Build to promote your working BPM.
              </>
            )}
          </p>
          <button
            onClick={handleStart}
            className="mt-4 block w-full rounded-lg bg-accent px-6 py-5 text-center text-xl font-semibold text-black transition hover:bg-accent-strong"
          >
            {exercise.openEnded
              ? "Start open-ended session"
              : `Start ${exercise.sessionMinutes}-min session`}
          </button>
        </section>

        <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit exercise</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-accent hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          {editing && (
            <div className="mt-4">
              <ExerciseForm
                submitLabel="Save"
                initial={{
                  name: exercise.name,
                  link: exercise.link,
                  notes: exercise.notes,
                  workingBpm: exercise.workingBpm,
                  stepPercent: exercise.stepPercent,
                  sessionMinutes: exercise.sessionMinutes,
                  openEnded: exercise.openEnded,
                  metronomeEnabled: exercise.metronomeEnabled,
                  practiceMode: exercise.practiceMode,
                  includeWarmupBlock: exercise.includeWarmupBlock,
                }}
                onSubmit={async (values) => {
                  await updateExercise({
                    ...exercise,
                    ...values,
                  });
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            </div>
          )}
        </section>

        <section className="pt-4">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-neutral-500 transition hover:text-red-400"
            >
              Delete exercise
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded border border-red-900 bg-red-950/30 px-4 py-3 text-sm">
              <span className="text-red-200">Delete &ldquo;{exercise.name}&rdquo;?</span>
              <button
                onClick={async () => {
                  await deleteExercise(exercise.id);
                  router.push("/");
                }}
                className="rounded bg-red-700 px-3 py-1 font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatBuildDuration(sessionMinutes: number): string {
  const buildSec = sessionMinutes * 60 - 120;
  if (buildSec % 60 === 0) return `${buildSec / 60} min`;
  const min = Math.floor(buildSec / 60);
  const sec = buildSec % 60;
  return min > 0 ? `${min} min ${sec} sec` : `${sec} sec`;
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={highlight ? "text-lg font-semibold text-accent" : "text-base text-neutral-200"}>
        {value}
      </div>
    </div>
  );
}
