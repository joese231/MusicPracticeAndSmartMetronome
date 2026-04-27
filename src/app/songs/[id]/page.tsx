"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { SongForm } from "@/components/songs/SongForm";
import { LatestRecordingPanel } from "@/components/songs/LatestRecordingPanel";
import { BpmTimelineChart } from "@/components/stats/BpmTimelineChart";
import { RecentSessionsList } from "@/components/stats/RecentSessionsList";
import { formatPracticeTime } from "@/lib/format";
import { unlockSharedAudioContext } from "@/lib/metronome/scheduler";
import {
  overspeedBpm,
  slowMusicalBpm,
  slowReferenceBpm,
  targetBpm,
  troubleBlockBpmFor,
} from "@/lib/session/tempo";
import {
  clampSessionMinutes,
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  sessionLengthSec,
} from "@/lib/session/blocks";

const PRESETS = [5, 10, 15, 20, 30];
const DEFAULT_PRESET = 10;

export default function SongDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const loaded = useSongsStore((s) => s.loaded);
  const load = useSongsStore((s) => s.load);
  const song = useSongsStore((s) => s.songs.find((x) => x.id === id));
  const updateSong = useSongsStore((s) => s.updateSong);
  const deleteSong = useSongsStore((s) => s.deleteSong);

  const records = useSessionHistoryStore((s) => s.records);
  const historyLoaded = useSessionHistoryStore((s) => s.loaded);
  const loadHistory = useSessionHistoryStore((s) => s.load);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(DEFAULT_PRESET);
  const [customMinutes, setCustomMinutes] = useState<string>("");

  useEffect(() => {
    if (!loaded) void load();
    if (!historyLoaded) void loadHistory();
  }, [loaded, load, historyLoaded, loadHistory]);

  const songRecords = useMemo(
    () => (id ? records.filter((r) => r.itemId === id) : []),
    [records, id],
  );

  const helperText = useMemo(() => {
    if (!song) return "";
    const lengthSec = sessionLengthSec(selectedMinutes, song);
    const lengthMin = Math.round(lengthSec / 60);
    const count = song.troubleSpots.length;
    const tail =
      " A Conscious Practice warm-up runs first — you end it when ready. Blocks pause between each other so you can finish your current pass — actual wall-clock length will be a bit longer.";
    if (selectedMinutes === 5) {
      return "5-min compact session — skips trouble-spot blocks by design." + tail;
    }
    if (count === 0) {
      return `${selectedMinutes} min base, no trouble spots → ${lengthMin} min of playing.` + tail;
    }
    if (count === 1) {
      return `${selectedMinutes} min base, 1 trouble spot → ${lengthMin} min of playing.` + tail;
    }
    const extra = count - 1;
    return (
      `${selectedMinutes} min base + ${extra} extra trouble spot${extra > 1 ? "s" : ""} → ${lengthMin} min of playing.` +
      tail
    );
  }, [selectedMinutes, song]);

  if (!loaded) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-neutral-500">Loading...</main>
    );
  }

  if (!song) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Song not found</h1>
      </main>
    );
  }

  const target = targetBpm(song);
  const overspeed = overspeedBpm(song);
  const slowRef = slowReferenceBpm(song);
  const slowMus = slowMusicalBpm(song);

  const handlePickPreset = (m: number) => {
    setSelectedMinutes(m);
    setCustomMinutes("");
  };

  const handleStartCustom = () => {
    const parsed = parseInt(customMinutes, 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = clampSessionMinutes(parsed);
    unlockSharedAudioContext();
    router.push(`/session/${song.id}?minutes=${clamped}`);
  };

  const handleStartPreset = () => {
    unlockSharedAudioContext();
    router.push(`/session/${song.id}?minutes=${selectedMinutes}`);
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
        ← Back
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight">{song.title}</h1>
          {song.link && (
            <a
              href={song.link}
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
        <LatestRecordingPanel songId={song.id} />

        {songRecords.length > 0 && (
          <>
            <BpmTimelineChart
              records={songRecords}
              itemId={song.id}
              troubleSpotCount={song.troubleSpots.length}
            />
            <RecentSessionsList records={songRecords} limit={10} />
          </>
        )}

        <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <Stat label="Working" value={`${song.workingBpm} BPM`} highlight />
            <Stat label="Target" value={`${target} BPM`} />
            <Stat label="Overspeed" value={`${overspeed} BPM`} />
            {song.troubleSpots.length === 0 ? (
              <Stat label="Trouble spots" value="None" />
            ) : (
              song.troubleSpots.map((ts, i) => {
                const label =
                  song.troubleSpots.length > 1 ? `Trouble ${i + 1}` : "Trouble";
                const value =
                  ts.bpm != null
                    ? `${ts.bpm} BPM`
                    : `${troubleBlockBpmFor(song, i)} BPM (auto)`;
                return <Stat key={i} label={label} value={value} />;
              })
            )}
            {song.originalBpm != null && (
              <Stat label="Original" value={`${song.originalBpm} BPM`} />
            )}
            <Stat label="Slow ref" value={`${slowRef} BPM`} />
            <Stat label="Slow musical" value={`${slowMus} BPM`} />
            <Stat label="Step" value={`${song.stepPercent}%`} />
            <Stat label="Total practice" value={formatPracticeTime(song.totalPracticeSec)} />
          </div>
        </section>

        <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
          <h2 className="text-lg font-semibold">Start session</h2>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {PRESETS.map((m) => {
              const selected = selectedMinutes === m && customMinutes === "";
              return (
                <button
                  key={m}
                  onClick={() => handlePickPreset(m)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-accent text-black"
                      : "border border-bg-border text-neutral-300 hover:border-accent hover:text-neutral-100"
                  }`}
                >
                  {m} min
                </button>
              );
            })}
            <div className="flex items-center gap-2 pl-2">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_SESSION_MINUTES}
                max={MAX_SESSION_MINUTES}
                placeholder="Custom"
                value={customMinutes}
                onChange={(e) => {
                  setCustomMinutes(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (Number.isFinite(parsed)) {
                    setSelectedMinutes(clampSessionMinutes(parsed));
                  }
                }}
                className="w-24 rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
              />
              <button
                onClick={handleStartCustom}
                disabled={customMinutes.trim() === ""}
                className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-200 transition hover:border-accent disabled:opacity-40"
              >
                Start custom
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">{helperText}</div>

          <button
            onClick={handleStartPreset}
            className="mt-4 block w-full rounded-lg bg-accent px-6 py-5 text-center text-xl font-semibold text-black transition hover:bg-accent-strong"
          >
            Start {selectedMinutes}-min session
          </button>
        </section>

        <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit song</h2>
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
              <SongForm
                submitLabel="Save"
                initial={{
                  title: song.title,
                  link: song.link,
                  workingBpm: song.workingBpm,
                  troubleSpots: song.troubleSpots,
                  originalBpm: song.originalBpm,
                  stepPercent: song.stepPercent,
                  practiceMode: song.practiceMode,
                  includeWarmupBlock: song.includeWarmupBlock,
                }}
                onSubmit={async (values) => {
                  await updateSong({
                    ...song,
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
              Delete song
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded border border-red-900 bg-red-950/30 px-4 py-3 text-sm">
              <span className="text-red-200">Delete &ldquo;{song.title}&rdquo;?</span>
              <button
                onClick={async () => {
                  await deleteSong(song.id);
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
