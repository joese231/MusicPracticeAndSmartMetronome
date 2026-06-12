"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useSessionStore } from "@/lib/store/useSessionStore";
import {
  useSessionHistoryStore,
  genSessionRecordId,
} from "@/lib/store/useSessionHistoryStore";
import type {
  PromotionEvent,
  SessionRecord,
} from "@/types/sessionRecord";
import {
  enableMetronomeDebug,
} from "@/lib/metronome/scheduler";
import {
  buildBlocks,
  clampSessionMinutes,
  songBlockStructureKey,
} from "@/lib/session/blocks";
import {
  nowIso,
  promoteWorking,
  promoteTroubleAt,
  warmupBpmFor,
  workingBpmForTempo,
} from "@/lib/session/tempo";
import { usePracticeSession } from "@/lib/session/usePracticeSession";
import type { Song } from "@/types/song";
import type { BlockDef } from "@/types/block";

import { MetronomeDiagnosticsPanel } from "@/components/session/MetronomeDiagnostics";
import { BpmEditorModal } from "@/components/session/BpmEditorModal";
import { BetweenItemsOverlay } from "@/components/session/BetweenItemsOverlay";
import { SessionShell } from "@/components/session/SessionShell";

type BetweenSongs = {
  nextSongId: string;
  nextSongTitle: string;
  startedAtMs: number;
  durationSec: number;
};

export default function SessionPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-neutral-500">
          Loading session...
        </main>
      }
    >
      <SessionPage />
    </Suspense>
  );
}

function SessionPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = params.id;
  const debug = search.get("debug") === "1";
  useEffect(() => {
    enableMetronomeDebug(debug);
    return () => {
      if (debug) enableMetronomeDebug(false);
    };
  }, [debug]);

  const loadedSongs = useSongsStore((s) => s.loaded);
  const loadSongs = useSongsStore((s) => s.load);
  const songs = useSongsStore((s) => s.songs);
  const song = useSongsStore((s) => s.songs.find((x) => x.id === id));
  const updateSong = useSongsStore((s) => s.updateSong);

  const settings = useSettingsStore((s) => s.settings);
  const loadedSettings = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);

  const setLatestRecording = useSessionStore((s) => s.setLatestRecording);
  const clearLatestRecording = useSessionStore((s) => s.clearLatestRecording);

  const completeSessionRecord = useSessionHistoryStore((s) => s.complete);

  const [betweenSongs, setBetweenSongs] = useState<BetweenSongs | null>(null);
  const [betweenSongsPaused, setBetweenSongsPaused] = useState(false);
  const [bpmEditorOpen, setBpmEditorOpen] = useState(false);
  // Transient "2× slower" toggle for the Conscious Practice block. When on,
  // halves whatever the block would otherwise play (the saved warmupBpm,
  // or the ⅓ fallback). Never persisted; resets when the block advances or
  // when the user picks an explicit BPM via the editor.
  const [consciousSlowMode, setConsciousSlowMode] = useState(false);
  const [consciousBpmEditorOpen, setConsciousBpmEditorOpen] = useState(false);
  const betweenSongsRef = useRef<BetweenSongs | null>(null);
  betweenSongsRef.current = betweenSongs;
  const betweenSongsPausedRef = useRef(false);
  betweenSongsPausedRef.current = betweenSongsPaused;
  // Wall-clock ms when the inter-song countdown was paused. On resume we
  // shift startedAtMs forward by the paused delta so the frozen remaining
  // time resumes cleanly.
  const betweenSongsPausedAtRef = useRef<number>(0);

  const startWorkingBpmRef = useRef<number | null>(null);
  const startTroubleBpmsRef = useRef<(number | null)[]>([]);
  const promotionsRef = useRef<PromotionEvent[]>([]);
  const songRuntimeRef = useRef<Song | null>(null);
  const earnedHandlerRef = useRef<() => void>(() => {});
  const endSessionRef = useRef<(reason: "complete" | "abort") => void>(
    () => {},
  );
  const handleBetweenSongsSkipRef = useRef<() => void>(() => {});
  const handleBetweenSongsCancelRef = useRef<() => void>(() => {});
  const handleBetweenSongsPauseToggleRef = useRef<() => void>(() => {});
  const durationMinutes = clampSessionMinutes(song?.defaultSessionMinutes ?? 10);

  useEffect(() => {
    if (!loadedSongs) void loadSongs();
    if (!loadedSettings) void loadSettings();
  }, [loadedSongs, loadSongs, loadedSettings, loadSettings]);

  useEffect(() => {
    if (song) songRuntimeRef.current = song;
  }, [song]);

  const blockStructureKey = song ? songBlockStructureKey(song) : "";
  const blocks = useMemo<BlockDef[]>(
    () => (song ? buildBlocks(durationMinutes, song) : []),
    // Blocks are captured once per session start. tempoFns close over the
    // runtime song ref so mid-session promotions still flow through. The
    // structure key intentionally captures template/mode changes without
    // rebuilding on every BPM-only song update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [durationMinutes, song?.id, blockStructureKey],
  );

  const practice = usePracticeSession({
    blocks,
    runtimeSubjectRef: songRuntimeRef,
    settings,
    metronomeMode: "all",
    clearLatestRecording,
    getStartSubject: () => song ?? null,
    onBeforeStart: (subject) => {
      songRuntimeRef.current = subject as Song;
    },
    onSessionStarted: (_startMs, subject) => {
      const startSong = subject as Song;
      startWorkingBpmRef.current = startSong.workingBpm;
      startTroubleBpmsRef.current = startSong.troubleSpots.map((s) => s.bpm);
      promotionsRef.current = [];
    },
    onBlockStarted: (block) => {
      if (block.kind !== "consciousPractice") {
        setConsciousSlowMode(false);
      }
    },
    onComplete: () => endSessionRef.current("complete"),
    onAbort: () => endSessionRef.current("abort"),
    onPlus: () => earnedHandlerRef.current(),
    isIntermissionActive: () => !!betweenSongsRef.current,
    onIntermissionSkip: () => handleBetweenSongsSkipRef.current(),
    onIntermissionCancel: () => handleBetweenSongsCancelRef.current(),
    onIntermissionPauseToggle: () => handleBetweenSongsPauseToggleRef.current(),
    createMetronomeWhenSilent: true,
  });

  const endSession = useCallback(
    async (reason: "complete" | "abort") => {
      await practice.finishSession(reason, async ({ elapsedSec, startedAt, recorder }) => {
      const songId = song?.id;

      if (songId && startedAt) {
        const songNow = songRuntimeRef.current ?? song;
        const rec: SessionRecord = {
          id: genSessionRecordId(),
          itemId: songId,
          itemKind: "song",
          itemTitle: song?.title ?? songId,
          startedAt,
          endedAt: new Date().toISOString(),
          durationSec: Math.max(0, Math.round(elapsedSec)),
          endedReason: reason,
          plannedMinutes: durationMinutes,
          startWorkingBpm: startWorkingBpmRef.current ?? undefined,
          endWorkingBpm: songNow?.workingBpm ?? startWorkingBpmRef.current ?? undefined,
          startTroubleBpms: startTroubleBpmsRef.current,
          endTroubleBpms: songNow ? songNow.troubleSpots.map((s) => s.bpm) : [],
          promotions: promotionsRef.current.slice(),
        };
        void completeSessionRecord(rec)
          .then(() => loadSongs())
          .catch(() => {
            // best-effort — never block session teardown
          });
      }

      if (recorder && songId) {
        try {
          const result = await recorder.stop();
          const blobUrl = URL.createObjectURL(result.blob);
          setLatestRecording({
            songId,
            blob: result.blob,
            blobUrl,
            durationSec: result.durationSec,
            durationMinutes,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // swallow
        }
      }

      // On a normal completion, flow straight into the next song in the
      // user's ordered list at the same session length. This skips the trip
      // back through the song detail page. On abort (Esc / End), fall back
      // to the song detail page so the user can review the recording.
      if (reason === "complete" && songId) {
        const idx = songs.findIndex((x) => x.id === songId);
        const next = idx >= 0 ? songs[idx + 1] : undefined;
        if (next) {
          const pauseSec = Math.max(0, settings.interSongPauseSec);
          if (pauseSec > 0) {
            // Enter a visible countdown state instead of routing immediately.
            // A sibling effect watches `betweenSongs` and routes when the
            // timer expires (or when the user presses Space to skip).
            setBetweenSongs({
              nextSongId: next.id,
              nextSongTitle: next.title,
              startedAtMs: Date.now(),
              durationSec: pauseSec,
            });
            return;
          }
          router.push(`/session/${next.id}`);
          return;
        }
      }

      if (songId) router.push(`/songs/${songId}`);
      else router.push("/");
      });
    },
    [
      durationMinutes,
      loadSongs,
      practice,
      router,
      setLatestRecording,
      song,
      songs,
      settings.interSongPauseSec,
      completeSessionRecord,
    ],
  );
  endSessionRef.current = (reason) => {
    void endSession(reason);
  };

  // Auto-start as soon as data is loaded — the user already committed by
  // clicking "Start N-minute session" on the song page.
  //
  // The setTimeout-and-clear dance is load-bearing under React 18 Strict
  // Mode: Strict Mode runs effects setup → cleanup → setup on mount, and the
  // sibling [] cleanup effect disposes metronomeRef.current during the fake
  // unmount. By deferring startSession to a macrotask and clearing that
  // timeout in this effect's own cleanup, the first (doomed) setup's timer
  // is cancelled before it fires; only the second setup's timer actually
  // runs, by which point the double-invoke dance has settled.
  useEffect(() => {
    if (!loadedSongs || !loadedSettings) return;
    if (!song) return;
    if (practice.started || practice.startingRef.current) return;
    const t = setTimeout(() => {
      void practice.startSession();
    }, 0);
    return () => clearTimeout(t);
  }, [loadedSongs, loadedSettings, song, practice]);

  const currentBlock = practice.currentBlock;
  const nextBlock = practice.nextBlock;
  const snap = practice.snap;
  const started = practice.started;
  const paused = practice.paused;
  const nowMs = practice.nowMs;
  const setSnap = practice.setSnap;
  const pausedRef = practice.pausedRef;
  const metronomeRef = practice.metronomeRef;
  const addToast = practice.addToast;
  const advance = practice.advance;
  const recordingActive = practice.recordingActive;
  const metronomeMode = practice.metronomeMode;
  const setMetronomeMode = practice.setMetronomeMode;
  const toasts = practice.toasts;

  const tempoBpm = useMemo(() => {
    if (!currentBlock) return 0;
    const s = songRuntimeRef.current ?? song;
    if (!s) return 0;
    const base = currentBlock.tempoFn(s);
    if (currentBlock.kind === "consciousPractice" && consciousSlowMode) {
      return Math.max(20, Math.floor(warmupBpmFor(s) / 2));
    }
    return base;
    // Recompute when the visible song changes (mid-session promotion or a
    // warmupBpm save) and when the slow-mode toggle flips.
  }, [currentBlock, song, consciousSlowMode]);

  // Push tempoBpm to the live metronome while in the warm-up block. Other
  // blocks have their own setBpm calls (handleEarned / handleEditBpm /
  // phase transition), but the warm-up's BPM changes via the saved
  // warmupBpm field on the song or the slow-mode toggle, neither of which
  // goes through those paths.
  useEffect(() => {
    if (!started || !snap || snap.phase !== "playing") return;
    const block = blocks[snap.blockIndex];
    if (!block || block.kind !== "consciousPractice") return;
    if (tempoBpm <= 0) return;
    metronomeRef.current?.setBpm(tempoBpm);
  }, [tempoBpm, snap, started, blocks, metronomeRef]);

  const timeLeftSec = practice.timeLeftSec;

  const showEarnedButton =
    !!currentBlock &&
    currentBlock.showEarnedButton &&
    snap?.phase === "playing" &&
    !paused;

  const canPause = snap?.phase === "playing";
  const canReset = snap?.phase === "playing" && !paused;
  const canEditBpm = snap?.phase === "playing" && !paused;
  const isConscious = currentBlock?.kind === "consciousPractice";
  const isUnbounded = !!currentBlock?.unbounded;
  const elapsedSec = practice.elapsedSec;
  // Played BPM during the warm-up — already reflects the slow-mode toggle
  // and the saved warmupBpm via tempoBpm.
  const consciousPlayedBpm = currentBlock ? tempoBpm : 0;
  // Default = the ⅓ rule, ignoring any saved warmupBpm. Used as the
  // "Default (X)" chip label so the player can see what they'd revert to.
  const consciousDefaultBpm = song
    ? Math.max(20, Math.round(workingBpmForTempo(song) / 3))
    : 0;
  // 2× slower of whatever the current saved warmup is (or the ⅓ fallback).
  const consciousSlowerBpm = song
    ? Math.max(20, Math.floor(warmupBpmFor(song) / 2))
    : 0;
  const consciousIsSlower = isConscious && consciousSlowMode;
  const consciousIsDefault =
    isConscious && !consciousSlowMode && (song?.warmupBpm ?? null) == null;

  const bpmEditor = useMemo(() => {
    if (!currentBlock) return null;
    const songNow = songRuntimeRef.current ?? song;
    if (!songNow) return null;
    if (currentBlock.promotes?.kind === "trouble") {
      const idx = currentBlock.promotes.index;
      const spot = songNow.troubleSpots[idx];
      const total = songNow.troubleSpots.length;
      const label = total > 1 ? `Trouble Spot ${idx + 1}` : "Trouble Spot";
      const playedBpm = currentBlock.tempoFn(songNow);
      const fallback = spot?.bpm == null;
      return {
        title: `Edit ${label} BPM`,
        helperText: fallback
          ? `This spot has no stored BPM — it's playing at ${playedBpm} (slow reference fallback).`
          : `This block plays at ${playedBpm} BPM.`,
        initialBpm: spot?.bpm ?? playedBpm,
      };
    }
    const playedBpm = currentBlock.tempoFn(songNow);
    if (songNow.workingBpm == null) return null;
    const isDerived = playedBpm !== songNow.workingBpm;
    return {
      title: "Edit Working BPM",
      helperText: isDerived
        ? `This block plays at ${playedBpm} BPM (derived from working ${songNow.workingBpm}).`
        : `This block plays at ${playedBpm} BPM.`,
      initialBpm: songNow.workingBpm,
    };
  }, [currentBlock, song]);

  const handleEarned = useCallback(async () => {
    if (!snap || snap.phase !== "playing") return;
    const block = blocks[snap.blockIndex];
    const songNow = songRuntimeRef.current;
    if (!block || !songNow || !block.showEarnedButton) return;

    const promotes = block.promotes;
    if (!promotes) return;

    if (promotes.kind === "working") {
      if (songNow.workingBpm == null) return;
      const oldBpm = songNow.workingBpm;
      const promoted = promoteWorking(songNow);
      songRuntimeRef.current = promoted;
      const newBpm = block.tempoFn(promoted);
      metronomeRef.current?.setBpm(newBpm);
      promotionsRef.current.push({
        at: nowIso(),
        kind: "working",
        fromBpm: oldBpm,
        toBpm: promoted.workingBpm ?? oldBpm,
        stepPercent: songNow.stepPercent,
      });
      addToast(`Working: ${oldBpm} → ${promoted.workingBpm}`);
      await updateSong(promoted);
    } else if (promotes.kind === "trouble") {
      const idx = promotes.index;
      const spot = songNow.troubleSpots[idx];
      if (!spot || spot.bpm == null) return;
      const oldBpm = spot.bpm;
      const promoted = promoteTroubleAt(songNow, idx);
      const newSpot = promoted.troubleSpots[idx];
      if (!newSpot || newSpot.bpm == null) return;
      songRuntimeRef.current = promoted;
      const newBpm = block.tempoFn(promoted);
      metronomeRef.current?.setBpm(newBpm);
      promotionsRef.current.push({
        at: nowIso(),
        kind: "trouble",
        troubleIndex: idx,
        fromBpm: oldBpm,
        toBpm: newSpot.bpm,
        stepPercent: songNow.stepPercent,
      });
      const label =
        promoted.troubleSpots.length > 1 ? `Trouble ${idx + 1}` : "Trouble";
      addToast(`${label}: ${oldBpm} → ${newSpot.bpm}`);
      await updateSong(promoted);
    }
  }, [snap, blocks, updateSong, addToast, metronomeRef]);
  earnedHandlerRef.current = () => {
    void handleEarned();
  };

  const handleSkip = practice.handleSkip;
  const handleRepeatBlock = practice.handleRepeatBlock;
  const handlePrevious = practice.handlePrevious;
  const handlePauseToggle = practice.handlePauseToggle;

  // Edit the underlying BPM of the currently-playing block and persist the
  // correction to the song. Trouble Spot blocks edit that spot's `bpm`;
  // every other block edits `workingBpm` (the block tempo is then a
  // derivative of working, so editing working retunes the current block
  // automatically through `block.tempoFn`).
  const handleEditBpm = useCallback(
    async (newBpm: number) => {
      if (!snap || snap.phase !== "playing") return;
      const block = blocks[snap.blockIndex];
      const songNow = songRuntimeRef.current;
      if (!block || !songNow) return;

      let updated: Song;
      let label: string;
      let oldBpm: number;

      if (block.promotes?.kind === "trouble") {
        const idx = block.promotes.index;
        const spot = songNow.troubleSpots[idx];
        oldBpm = spot?.bpm ?? block.tempoFn(songNow);
        const nextSpots = songNow.troubleSpots.map((s, i) =>
          i === idx ? { ...s, bpm: newBpm } : s,
        );
        updated = { ...songNow, troubleSpots: nextSpots, updatedAt: nowIso() };
        label =
          songNow.troubleSpots.length > 1 ? `Trouble ${idx + 1}` : "Trouble";
      } else {
        if (songNow.workingBpm == null) return;
        oldBpm = songNow.workingBpm;
        updated = { ...songNow, workingBpm: newBpm, updatedAt: nowIso() };
        label = "Working";
      }

      songRuntimeRef.current = updated;
      metronomeRef.current?.setBpm(block.tempoFn(updated));
      setBpmEditorOpen(false);
      addToast(`${label}: ${oldBpm} → ${newBpm}`);
      await updateSong(updated);
    },
    [snap, blocks, updateSong, addToast, metronomeRef],
  );

  const handleResetBlock = practice.handleResetBlock;

  // Skip the inter-song countdown — route to the next song immediately.
  const handleBetweenSongsSkip = useCallback(() => {
    const b = betweenSongsRef.current;
    if (!b) return;
    router.push(`/session/${b.nextSongId}`);
  }, [router]);

  // Cancel the inter-song countdown — drop back to the home screen.
  const handleBetweenSongsCancel = useCallback(() => {
    if (!betweenSongsRef.current) return;
    router.push("/");
  }, [router]);

  // Pause / resume the inter-song countdown. Mirrors the block-pause shape:
  // on pause we freeze startedAtMs derivation by stashing nowMs and flipping
  // the flag; on resume we shift startedAtMs forward by the paused span so
  // the remaining time picks up exactly where it froze.
  const handleBetweenSongsPauseToggle = useCallback(() => {
    const current = betweenSongsRef.current;
    if (!current) return;
    if (betweenSongsPausedRef.current) {
      const delta = Date.now() - betweenSongsPausedAtRef.current;
      betweenSongsPausedAtRef.current = 0;
      setBetweenSongs({ ...current, startedAtMs: current.startedAtMs + delta });
      setBetweenSongsPaused(false);
    } else {
      betweenSongsPausedAtRef.current = Date.now();
      setBetweenSongsPaused(true);
    }
  }, []);
  handleBetweenSongsSkipRef.current = handleBetweenSongsSkip;
  handleBetweenSongsCancelRef.current = handleBetweenSongsCancel;
  handleBetweenSongsPauseToggleRef.current = handleBetweenSongsPauseToggle;

  // Auto-route when the inter-song countdown hits 0. Uses setTimeout rather
  // than deriving from the RAF `nowMs` so the route fires even if the tab
  // backgrounds and RAF throttles. Pausing the countdown unmounts the
  // scheduled route; on resume the effect re-runs with a shifted
  // startedAtMs and re-schedules with the frozen remaining time.
  useEffect(() => {
    if (!betweenSongs) return;
    if (betweenSongsPaused) return;
    const remainingMs = Math.max(
      0,
      betweenSongs.startedAtMs + betweenSongs.durationSec * 1000 - Date.now(),
    );
    const t = setTimeout(() => {
      router.push(`/session/${betweenSongs.nextSongId}`);
    }, remainingMs);
    return () => clearTimeout(t);
  }, [betweenSongs, betweenSongsPaused, router, durationMinutes]);

  if (!loadedSongs || !loadedSettings) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Loading...
      </main>
    );
  }

  if (!song) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-bold">Song not found</h1>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Back to home
        </button>
      </main>
    );
  }

  if (!started || !snap) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Starting session…
      </main>
    );
  }

  if (betweenSongs) {
    // When paused, lock the displayed remaining time to the moment the user
    // hit pause — otherwise `nowMs` keeps marching from the RAF loop and the
    // big number would count down visually even though routing is frozen.
    const effectiveNowMs = betweenSongsPaused
      ? betweenSongsPausedAtRef.current
      : nowMs;
    const elapsedMs = effectiveNowMs - betweenSongs.startedAtMs;
    const remainingSec = Math.max(
      0,
      Math.ceil(betweenSongs.durationSec - elapsedMs / 1000),
    );
    return (
      <BetweenItemsOverlay
        nextItemTitle={betweenSongs.nextSongTitle}
        remainingSec={remainingSec}
        paused={betweenSongsPaused}
        onSkip={handleBetweenSongsSkip}
        onCancel={handleBetweenSongsCancel}
        onPauseToggle={handleBetweenSongsPauseToggle}
      />
    );
  }

  const awaiting = snap.phase === "awaiting";

  return (
    <SessionShell
      title={song.title}
      subtitle={`${durationMinutes}-min session`}
      currentBlock={currentBlock}
      nextBlock={nextBlock}
      currentBlockLabel={
        currentBlock ? blockLabelWithTroubleIndex(currentBlock, blocks) : ""
      }
      nextBlockLabel={
        nextBlock ? blockLabelWithTroubleIndex(nextBlock, blocks) : ""
      }
      tempoBpm={tempoBpm}
      nextTempoBpm={
        nextBlock ? nextBlock.tempoFn(songRuntimeRef.current ?? song) : undefined
      }
      blockIndex={snap.blockIndex}
      totalBlocks={blocks.length}
      awaiting={awaiting}
      paused={paused}
      isUnbounded={isUnbounded}
      elapsedSec={elapsedSec}
      timeLeftSec={timeLeftSec}
      recordingActive={recordingActive}
      metronomeMode={metronomeMode}
      metronome={metronomeRef.current}
      showMetronomeControls={currentBlock?.metronomeEnabled !== false}
      showMetronomeIndicator={currentBlock?.metronomeEnabled !== false}
      canResetBlock={canReset}
      canEditBpm={canEditBpm}
      canPause={canPause}
      canPrevious={snap.blockIndex > 0 && !paused}
      showEarnedButton={showEarnedButton}
      earnedHint={
        showEarnedButton ? undefined : "Not available during this block"
      }
      beforePrimaryControls={
        isConscious && snap.phase === "playing" && !paused ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setConsciousSlowMode(false);
                const songNow = songRuntimeRef.current ?? song;
                if (!songNow || songNow.warmupBpm == null) return;
                const cleared: Song = {
                  ...songNow,
                  warmupBpm: null,
                  updatedAt: nowIso(),
                };
                songRuntimeRef.current = cleared;
                void updateSong(cleared);
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                consciousIsDefault
                  ? "border-accent bg-accent text-black"
                  : "border-bg-border text-neutral-300 hover:bg-bg-elevated"
              }`}
            >
              Default ({consciousDefaultBpm})
            </button>
            <button
              type="button"
              onClick={() => setConsciousSlowMode((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                consciousIsSlower
                  ? "border-accent bg-accent text-black"
                  : "border-bg-border text-neutral-300 hover:bg-bg-elevated"
              }`}
            >
              2× slower ({consciousSlowerBpm})
            </button>
            <button
              type="button"
              onClick={() => setConsciousBpmEditorOpen(true)}
              className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated"
            >
              Set BPM…
            </button>
          </div>
        ) : null
      }
      onMetronomeModeChange={setMetronomeMode}
      onResetBlock={handleResetBlock}
      onEditBpm={() =>
        isConscious ? setConsciousBpmEditorOpen(true) : setBpmEditorOpen(true)
      }
      onPauseToggle={handlePauseToggle}
      onPrevious={handlePrevious}
      onSkip={handleSkip}
      onEnd={() => void endSession("abort")}
      onEarned={handleEarned}
      onAdvance={advance}
      onRepeatBlock={handleRepeatBlock}
      toasts={toasts}
    >
      {bpmEditor && (
        <BpmEditorModal
          open={bpmEditorOpen}
          title={bpmEditor.title}
          helperText={bpmEditor.helperText}
          initialBpm={bpmEditor.initialBpm}
          onSave={(n) => void handleEditBpm(n)}
          onCancel={() => setBpmEditorOpen(false)}
        />
      )}

      {isConscious && (
        <BpmEditorModal
          open={consciousBpmEditorOpen}
          title="Conscious Practice BPM"
          helperText={`Saved to this song. Default is ${consciousDefaultBpm} (⅓ × ${workingBpmForTempo(song)}).`}
          initialBpm={consciousPlayedBpm}
          onSave={(n) => {
            const clamped = Math.max(20, n);
            const songNow = songRuntimeRef.current ?? song;
            const updated: Song = {
              ...songNow,
              warmupBpm: clamped,
              updatedAt: nowIso(),
            };
            songRuntimeRef.current = updated;
            setConsciousSlowMode(false);
            setConsciousBpmEditorOpen(false);
            void updateSong(updated);
          }}
          onCancel={() => setConsciousBpmEditorOpen(false)}
          onReset={
            song.warmupBpm != null
              ? () => {
                  const songNow = songRuntimeRef.current ?? song;
                  const cleared: Song = {
                    ...songNow,
                    warmupBpm: null,
                    updatedAt: nowIso(),
                  };
                  songRuntimeRef.current = cleared;
                  setConsciousSlowMode(false);
                  setConsciousBpmEditorOpen(false);
                  void updateSong(cleared);
                }
              : undefined
          }
        />
      )}

      {debug && <MetronomeDiagnosticsPanel metronome={metronomeRef.current} />}
    </SessionShell>
  );
}

function blockLabelWithTroubleIndex(
  block: BlockDef,
  allBlocks: BlockDef[],
): string {
  if (block.kind !== "troubleSpot" || block.promotes?.kind !== "trouble") {
    return block.label;
  }
  const total = allBlocks.filter((b) => b.kind === "troubleSpot").length;
  if (total <= 1) return block.label;
  return `Trouble Spot ${block.promotes.index + 1} of ${total}`;
}
