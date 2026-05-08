"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { SongList } from "@/components/songs/SongList";
import { ExerciseList } from "@/components/exercises/ExerciseList";
import { ACTIVE_TAB_STORAGE_KEY, type HomeTab } from "@/lib/ui/activeTab";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { lastPlayedItemId } from "@/lib/stats/aggregate";

type Tab = HomeTab;

export default function HomePage() {
  const songs = useSongsStore((s) => s.songs);
  const songsLoaded = useSongsStore((s) => s.loaded);
  const loadSongs = useSongsStore((s) => s.load);

  const exercises = useExercisesStore((s) => s.exercises);
  const exercisesLoaded = useExercisesStore((s) => s.loaded);
  const loadExercises = useExercisesStore((s) => s.load);

  const records = useSessionHistoryStore((s) => s.records);
  const sessionsLoaded = useSessionHistoryStore((s) => s.loaded);
  const loadSessions = useSessionHistoryStore((s) => s.load);

  const lastSongId = useMemo(
    () => lastPlayedItemId(records, "song"),
    [records],
  );
  const lastExerciseId = useMemo(
    () => lastPlayedItemId(records, "exercise"),
    [records],
  );

  const [tab, setTab] = useState<Tab>("songs");
  const tabSyncedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (stored === "songs" || stored === "exercises") setTab(stored);
    }
  }, []);

  useEffect(() => {
    // Skip the initial-mount write so we don't overwrite a value set by
    // setActiveHomeTab (called before navigation) before Effect A can read it.
    if (!tabSyncedRef.current) {
      tabSyncedRef.current = true;
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    }
  }, [tab]);

  useEffect(() => {
    if (!songsLoaded) void loadSongs();
    if (!exercisesLoaded) void loadExercises();
    if (!sessionsLoaded) void loadSessions();
  }, [
    songsLoaded,
    loadSongs,
    exercisesLoaded,
    loadExercises,
    sessionsLoaded,
    loadSessions,
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
        <nav className="flex items-center gap-5 text-sm text-neutral-400">
          <Link href="/stats" className="transition hover:text-neutral-100">
            Stats
          </Link>
          <Link href="/method" className="transition hover:text-neutral-100">
            Method
          </Link>
          <Link href="/settings" className="transition hover:text-neutral-100">
            Settings
          </Link>
        </nav>
      </header>

      <div className="mb-6 flex items-center gap-2 border-b border-bg-border">
        <TabButton active={tab === "songs"} onClick={() => setTab("songs")}>
          Songs
        </TabButton>
        <TabButton
          active={tab === "exercises"}
          onClick={() => setTab("exercises")}
        >
          Exercises
        </TabButton>
      </div>

      {tab === "songs" ? (
        <SongsPanel
          songs={songs}
          loaded={songsLoaded}
          lastPlayedId={lastSongId}
        />
      ) : (
        <ExercisesPanel
          exercises={exercises}
          loaded={exercisesLoaded}
          lastPlayedId={lastExerciseId}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-b-2 border-accent text-neutral-100"
          : "border-b-2 border-transparent text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function SongsPanel({
  songs,
  loaded,
  lastPlayedId,
}: {
  songs: ReturnType<typeof useSongsStore.getState>["songs"];
  loaded: boolean;
  lastPlayedId: string | null;
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-300">Your songs</h2>
        <Link
          href="/songs/new"
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-black transition hover:bg-accent-strong"
        >
          + Add song
        </Link>
      </div>

      {!loaded ? (
        <p className="text-neutral-500">Loading...</p>
      ) : songs.length === 0 ? (
        <SongsEmptyState />
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            Drag the ⋮⋮ handle to reorder. Your order is saved and stays put across sessions.
          </p>
          <SongList songs={songs} lastPlayedId={lastPlayedId} />
        </>
      )}
    </>
  );
}

function ExercisesPanel({
  exercises,
  loaded,
  lastPlayedId,
}: {
  exercises: ReturnType<typeof useExercisesStore.getState>["exercises"];
  loaded: boolean;
  lastPlayedId: string | null;
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-300">Your exercises</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/free-play"
            className="rounded-lg border border-bg-border px-4 py-2 font-semibold text-neutral-200 transition hover:bg-bg-elevated"
            title="A count-up timer for unstructured practice — transcribing, fiddling, or noodling. Time is recorded in your stats."
          >
            Free play
          </Link>
          <Link
            href="/exercises/new"
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-black transition hover:bg-accent-strong"
          >
            + Add exercise
          </Link>
        </div>
      </div>

      {!loaded ? (
        <p className="text-neutral-500">Loading...</p>
      ) : exercises.length === 0 ? (
        <ExercisesEmptyState />
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            Drag the ⋮⋮ handle to reorder. Tap an exercise to edit or run it.
          </p>
          <ExerciseList exercises={exercises} lastPlayedId={lastPlayedId} />
        </>
      )}
    </>
  );
}

function SongsEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-bg-border bg-bg-elevated/50 p-10 text-center">
      <h3 className="text-xl font-semibold text-neutral-200">Add your first song</h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
        This app runs structured 5-min or 10-min speed-practice sessions. You pick the song, it runs the tempo ladder, the block timer, and the metronome.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/songs/new"
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-black transition hover:bg-accent-strong"
        >
          Add your first song
        </Link>
        <Link
          href="/method"
          className="rounded-lg border border-bg-border px-5 py-2.5 font-semibold text-neutral-200 transition hover:bg-bg-elevated"
        >
          Read the method
        </Link>
      </div>
    </div>
  );
}

function ExercisesEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-bg-border bg-bg-elevated/50 p-10 text-center">
      <h3 className="text-xl font-semibold text-neutral-200">Add your first exercise</h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
        Exercises are short technique drills — scales, arpeggios, picking patterns. Each runs a fixed 5-minute session: warm-up, build, overspeed burst, cool-down.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/exercises/new"
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-black transition hover:bg-accent-strong"
        >
          Add your first exercise
        </Link>
      </div>
    </div>
  );
}
