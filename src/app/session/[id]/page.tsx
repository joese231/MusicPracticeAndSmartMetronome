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
  Metronome,
  type MetronomeMode,
  enableMetronomeDebug,
} from "@/lib/metronome/scheduler";
import { SessionRecorder } from "@/lib/audio/recorder";
import {
  advanceSnapshot,
  elapsedInPlayingSec,
  initialSnapshot,
  rewindSnapshot,
  tickSnapshot,
  timeLeftInPlayingSec,
} from "@/lib/session/driver";
import { buildBlocks, clampSessionMinutes } from "@/lib/session/blocks";
import {
  nowIso,
  promoteWorking,
  promoteTroubleAt,
  warmupBpmFor,
} from "@/lib/session/tempo";
import type { Song } from "@/types/song";
import type { BlockDef, DriverSnapshot } from "@/types/block";

import { BlockHeader } from "@/components/session/BlockHeader";
import { BlockCountdown } from "@/components/session/BlockCountdown";
import { BlockCountUp } from "@/components/session/BlockCountUp";
import { BlockInstructions } from "@/components/session/BlockInstructions";
import { EarnedButton } from "@/components/session/EarnedButton";
import { SkipBlockButton } from "@/components/session/SkipBlockButton";
import { PreviousBlockButton } from "@/components/session/PreviousBlockButton";
import { ShortcutsHint } from "@/components/session/ShortcutsHint";
import { RecordingIndicator } from "@/components/session/RecordingIndicator";
import { MetronomeIndicator } from "@/components/metronome/MetronomeIndicator";
import { MetronomeModeToggle } from "@/components/metronome/MetronomeModeToggle";
import { MetronomeDiagnosticsPanel } from "@/components/session/MetronomeDiagnostics";
import { BpmEditorModal } from "@/components/session/BpmEditorModal";
import { BetweenItemsOverlay } from "@/components/session/BetweenItemsOverlay";

type Toast = { id: number; text: string };

type BetweenSongs = {
  nextSongId: string;
  nextSongTitle: string;
  startedAtMs: number;
  durationSec: number;
};

// Brief pause before auto-advance kicks in when the legacy behavior is on.
const AUTO_ADVANCE_DELAY_MS = 1000;

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
  const minutesParam = search.get("minutes");
  const durationMinutes = clampSessionMinutes(
    minutesParam != null ? parseInt(minutesParam, 10) : 10,
  );
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
  const incrementPracticeTime = useSongsStore((s) => s.incrementPracticeTime);

  const settings = useSettingsStore((s) => s.settings);
  const loadedSettings = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);

  const setLatestRecording = useSessionStore((s) => s.setLatestRecording);
  const clearLatestRecording = useSessionStore((s) => s.clearLatestRecording);

  const appendSessionRecord = useSessionHistoryStore((s) => s.append);

  const [started, setStarted] = useState(false);
  const [metronomeMode, setMetronomeMode] = useState<MetronomeMode>("all");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
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

  // Explicit session state machine.
  const [snap, setSnap] = useState<DriverSnapshot | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const pausedRef = useRef(false);
  pausedRef.current = paused;
  // Wall-clock ms when we paused (0 when not paused). Used on resume/end to
  // shift blockStartMs + sessionStartMs forward so paused time doesn't count
  // toward the block countdown or totalPracticeSec.
  const pausedAtRef = useRef<number>(0);

  const sessionStartMsRef = useRef<number>(0);
  const sessionStartIsoRef = useRef<string>("");
  const startWorkingBpmRef = useRef<number>(0);
  const startTroubleBpmsRef = useRef<(number | null)[]>([]);
  const promotionsRef = useRef<PromotionEvent[]>([]);
  const songRuntimeRef = useRef<Song | null>(null);
  const metronomeRef = useRef<Metronome | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const recordingActiveRef = useRef(false);
  const endedRef = useRef(false);
  const [recordingActive, setRecordingActive] = useState(false);

  // autoAdvanceBlocks is read at phase-transition time via a ref so toggling
  // it in settings mid-session affects the *next* block break, not the whole
  // session retroactively.
  const autoAdvanceRef = useRef(settings.autoAdvanceBlocks);
  autoAdvanceRef.current = settings.autoAdvanceBlocks;

  useEffect(() => {
    if (!loadedSongs) void loadSongs();
    if (!loadedSettings) void loadSettings();
  }, [loadedSongs, loadSongs, loadedSettings, loadSettings]);

  useEffect(() => {
    if (song) songRuntimeRef.current = song;
  }, [song]);

  const blocks = useMemo<BlockDef[]>(
    () => (song ? buildBlocks(durationMinutes, song) : []),
    // Blocks are captured once per session start. tempoFns close over the
    // runtime song ref so mid-session promotions still flow through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [durationMinutes, song?.id, song?.troubleSpots.length],
  );

  const addToast = useCallback((text: string) => {
    const toastId = Date.now() + Math.random();
    setToasts((t) => [...t, { id: toastId, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 2200);
  }, []);

  // RAF loop: advance `nowMs` for the countdown, and call tickSnapshot which
  // flips the phase to `awaiting` the moment a playing block runs out.
  useEffect(() => {
    if (!started) return;
    let raf = 0;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      if (!pausedRef.current) {
        const n = Date.now();
        setNowMs(n);
        setSnap((prev) => (prev ? tickSnapshot(prev, blocks, n) : prev));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [started, blocks]);

  const endSession = useCallback(
    async (reason: "complete" | "abort") => {
      if (endedRef.current) return;
      endedRef.current = true;

      // If we're ending while paused, absorb the outstanding paused span into
      // sessionStartMsRef so that span doesn't get counted as practice.
      if (pausedAtRef.current > 0) {
        sessionStartMsRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = 0;
      }

      // Wall-clock elapsed — intentionally includes any awaiting gaps, since
      // time spent finishing the current pass still counts as practice.
      const elapsedSec = sessionStartMsRef.current
        ? (Date.now() - sessionStartMsRef.current) / 1000
        : 0;

      const m = metronomeRef.current;
      if (m) {
        m.stop();
        m.dispose();
        metronomeRef.current = null;
      }

      const songId = song?.id;
      if (songId) {
        void incrementPracticeTime(songId, Math.max(0, elapsedSec));
      }

      if (songId && sessionStartIsoRef.current) {
        const songNow = songRuntimeRef.current ?? song;
        const rec: SessionRecord = {
          id: genSessionRecordId(),
          itemId: songId,
          itemKind: "song",
          itemTitle: song?.title ?? songId,
          startedAt: sessionStartIsoRef.current,
          endedAt: new Date().toISOString(),
          durationSec: Math.max(0, Math.round(elapsedSec)),
          endedReason: reason,
          plannedMinutes: durationMinutes,
          startWorkingBpm: startWorkingBpmRef.current,
          endWorkingBpm: songNow?.workingBpm ?? startWorkingBpmRef.current,
          startTroubleBpms: startTroubleBpmsRef.current,
          endTroubleBpms: songNow ? songNow.troubleSpots.map((s) => s.bpm) : [],
          promotions: promotionsRef.current.slice(),
        };
        void appendSessionRecord(rec).catch(() => {
          // best-effort — never block session teardown
        });
      }

      const rec = recorderRef.current;
      if (rec && songId) {
        try {
          const result = await rec.stop();
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
      recorderRef.current = null;

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
          router.push(`/session/${next.id}?minutes=${durationMinutes}`);
          return;
        }
      }

      if (songId) router.push(`/songs/${songId}`);
      else router.push("/");
    },
    [
      durationMinutes,
      incrementPracticeTime,
      router,
      setLatestRecording,
      song,
      songs,
      settings.interSongPauseSec,
      appendSessionRecord,
    ],
  );

  // Advance from `awaiting` (or skip from `playing`) to the next block.
  // Resumes the metronome at the new block's tempo.
  const advance = useCallback(() => {
    setSnap((prev) => {
      if (!prev) return prev;
      return advanceSnapshot(prev, blocks, Date.now());
    });
  }, [blocks]);

  // Phase-transition side effects: drive the metronome off snapshot changes.
  const prevPhaseKeyRef = useRef<string>("");
  useEffect(() => {
    if (!started || !snap || endedRef.current) return;
    const key = `${snap.phase}-${snap.blockIndex}`;
    if (key === prevPhaseKeyRef.current) return;
    prevPhaseKeyRef.current = key;

    if (snap.phase === "ended") {
      void endSession("complete");
      return;
    }

    const m = metronomeRef.current;
    if (!m) return;

    if (snap.phase === "awaiting") {
      // Metronome keeps running at the current block's BPM so the player
      // can finish their current pass in time — only the chime fires.
      m.playTransitionCue();
      if (autoAdvanceRef.current) {
        const t = setTimeout(() => advance(), AUTO_ADVANCE_DELAY_MS);
        return () => clearTimeout(t);
      }
      return;
    }

    if (snap.phase === "playing") {
      const block = blocks[snap.blockIndex];
      const songNow = songRuntimeRef.current;
      if (!block || !songNow) return;
      // The transient "2× slower" toggle belongs to exactly one warm-up
      // block instance — drop it whenever a new block begins.
      if (block.kind !== "consciousPractice") {
        setConsciousSlowMode(false);
      }
      // Metronome is already running from startSession / the previous block;
      // just switch tempo for the new block. Slow-mode / saved-warmup
      // changes are pushed by the dedicated tempoBpm effect below.
      m.setBpm(block.tempoFn(songNow));
      // Align the accent pattern to the start of this block — otherwise
      // beatIndex's continuous count from session start produces downbeats
      // that land mid-bar relative to the block the player is focused on.
      m.alignToDownbeat();
    }
  }, [snap, started, blocks, advance, endSession]);


  useEffect(() => {
    metronomeRef.current?.setVolume(settings.metronomeVolume);
    metronomeRef.current?.setAccentsEnabled(settings.accentsEnabled);
  }, [settings.metronomeVolume, settings.accentsEnabled]);

  useEffect(() => {
    metronomeRef.current?.setMode(metronomeMode);
  }, [metronomeMode]);

  const startingRef = useRef(false);
  const startSession = useCallback(async () => {
    if (!song || started || startingRef.current) return;
    startingRef.current = true;

    clearLatestRecording();
    songRuntimeRef.current = song;

    // Dispose any leftover instance before installing a new one. Under
    // Strict-Mode or auto-advance edge cases a stale Metronome could still
    // be scheduling against the shared AudioContext; two live instances
    // interleaving beats on the same destination is the exact shape of
    // "weird, varying-volume clicks" we're hunting.
    const prev = metronomeRef.current;
    if (prev) {
      prev.stop();
      prev.dispose();
      metronomeRef.current = null;
    }

    const m = new Metronome();
    m.setVolume(settings.metronomeVolume);
    // Single-source read for accents: apply the current setting right before
    // start so there's no window where start-time state and the mirror
    // effect disagree.
    m.setAccentsEnabled(settings.accentsEnabled);
    metronomeRef.current = m;

    const firstBlock = blocks[0];
    const firstBpm = firstBlock.tempoFn(song);
    try {
      await m.start(firstBpm, metronomeMode);
    } catch {
      // swallow — next BPM change will retry
    }

    if (settings.recordingEnabled) {
      const rec = new SessionRecorder();
      try {
        await rec.start();
        recorderRef.current = rec;
        recordingActiveRef.current = true;
        setRecordingActive(true);
      } catch (err) {
        recorderRef.current = null;
        recordingActiveRef.current = false;
        setRecordingActive(false);
        addToast("Recording disabled — mic permission denied.");
        void err;
      }
    }

    const startMs = Date.now();
    sessionStartMsRef.current = startMs;
    sessionStartIsoRef.current = new Date(startMs).toISOString();
    startWorkingBpmRef.current = song.workingBpm;
    startTroubleBpmsRef.current = song.troubleSpots.map((s) => s.bpm);
    promotionsRef.current = [];
    // Pre-seed the phase key so the phase effect doesn't re-trigger start
    // behavior on the first `playing-0` snapshot.
    prevPhaseKeyRef.current = "playing-0";
    setSnap(initialSnapshot(startMs));
    setNowMs(startMs);
    setStarted(true);
  }, [
    song,
    started,
    blocks,
    metronomeMode,
    settings.metronomeVolume,
    settings.recordingEnabled,
    settings.accentsEnabled,
    clearLatestRecording,
    addToast,
  ]);

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
    if (started || startingRef.current) return;
    const t = setTimeout(() => {
      void startSession();
    }, 0);
    return () => clearTimeout(t);
  }, [loadedSongs, loadedSettings, song, started, startSession]);

  const currentBlock = snap ? blocks[snap.blockIndex] : undefined;
  const nextBlock = snap ? blocks[snap.blockIndex + 1] : undefined;

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
  }, [tempoBpm, snap, started, blocks]);

  const timeLeftSec =
    snap && currentBlock ? timeLeftInPlayingSec(snap, blocks, nowMs) : 0;

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
  const elapsedSec = snap ? elapsedInPlayingSec(snap, nowMs) : 0;
  // Played BPM during the warm-up — already reflects the slow-mode toggle
  // and the saved warmupBpm via tempoBpm.
  const consciousPlayedBpm = currentBlock ? tempoBpm : 0;
  // Default = the ⅓ rule, ignoring any saved warmupBpm. Used as the
  // "Default (X)" chip label so the player can see what they'd revert to.
  const consciousDefaultBpm = song
    ? Math.max(20, Math.round(song.workingBpm / 3))
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
      const oldBpm = songNow.workingBpm;
      const promoted = promoteWorking(songNow);
      songRuntimeRef.current = promoted;
      const newBpm = block.tempoFn(promoted);
      metronomeRef.current?.setBpm(newBpm);
      promotionsRef.current.push({
        at: nowIso(),
        kind: "working",
        fromBpm: oldBpm,
        toBpm: promoted.workingBpm,
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
  }, [snap, blocks, updateSong, addToast]);

  // Skip button: jump straight to the next block regardless of phase.
  const handleSkip = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    advance();
  }, [snap, advance]);

  // Previous block button: step back to the prior block and restart it.
  const handlePrevious = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    if (snap.blockIndex === 0) return;
    setSnap((prev) =>
      prev ? rewindSnapshot(prev, blocks, Date.now()) : prev,
    );
  }, [snap, blocks]);

  // Pause / resume during a playing block. Freezes the metronome, the RAF
  // countdown, and the practice-time accumulator by shifting blockStartMs
  // and sessionStartMs forward by the paused duration on resume.
  const handlePauseToggle = useCallback(() => {
    if (!snap) return;
    if (pausedRef.current) {
      const delta = Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
      sessionStartMsRef.current += delta;
      setSnap((s) => (s ? { ...s, blockStartMs: s.blockStartMs + delta } : s));
      metronomeRef.current?.resume();
      setPaused(false);
    } else {
      if (snap.phase !== "playing") return;
      pausedAtRef.current = Date.now();
      metronomeRef.current?.pause();
      setPaused(true);
    }
  }, [snap]);

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
    [snap, blocks, updateSong, addToast],
  );

  // Restart the current block's countdown from its full duration and
  // realign the metronome's accent pattern to a downbeat so the fresh
  // take starts musically on beat 1. Only meaningful during `playing`
  // phase.
  const handleResetBlock = useCallback(() => {
    if (!snap || snap.phase !== "playing") return;
    if (pausedRef.current) return;
    const now = Date.now();
    setSnap((s) => (s ? { ...s, blockStartMs: now } : s));
    metronomeRef.current?.alignToDownbeat();
    addToast("Block reset");
  }, [snap, addToast]);

  // Skip the inter-song countdown — route to the next song immediately.
  const handleBetweenSongsSkip = useCallback(() => {
    const b = betweenSongsRef.current;
    if (!b) return;
    router.push(`/session/${b.nextSongId}?minutes=${durationMinutes}`);
  }, [router, durationMinutes]);

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
      router.push(
        `/session/${betweenSongs.nextSongId}?minutes=${durationMinutes}`,
      );
    }, remainingMs);
    return () => clearTimeout(t);
  }, [betweenSongs, betweenSongsPaused, router, durationMinutes]);

  // Space: advance to the next block regardless of phase.
  const handleSpace = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    advance();
  }, [snap, advance]);

  // "+" key: promote BPM (same as the "I earned it" button).
  const handlePlus = useCallback(() => {
    if (!snap || snap.phase !== "playing") return;
    if (pausedRef.current) return;
    const block = blocks[snap.blockIndex];
    if (!block?.showEarnedButton) return;
    void handleEarned();
  }, [snap, blocks, handleEarned]);

  // Keyboard listener — unconditional, handlers via ref so we don't reattach
  // on every RAF tick.
  const startedRef = useRef(started);
  startedRef.current = started;
  const keyHandlersRef = useRef({
    handleSpace,
    handlePlus,
    handleSkip,
    handlePauseToggle,
    handleResetBlock,
    handleBetweenSongsSkip,
    handleBetweenSongsCancel,
    handleBetweenSongsPauseToggle,
    endSession,
  });
  keyHandlersRef.current = {
    handleSpace,
    handlePlus,
    handleSkip,
    handlePauseToggle,
    handleResetBlock,
    handleBetweenSongsSkip,
    handleBetweenSongsCancel,
    handleBetweenSongsPauseToggle,
    endSession,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!startedRef.current) return;
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      const h = keyHandlersRef.current;

      // Inter-song countdown has its own lean keymap: Space skips, Esc
      // cancels back to home. Other shortcuts are silenced here — the
      // session has already ended, so Skip/Pause/Reset/Earned are no-ops.
      if (betweenSongsRef.current) {
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          h.handleBetweenSongsSkip();
        } else if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          e.stopPropagation();
          h.handleBetweenSongsPauseToggle();
        } else if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          e.stopPropagation();
          h.handleBetweenSongsCancel();
        }
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        h.handleSpace();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        e.stopPropagation();
        h.handlePlus();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        e.stopPropagation();
        h.handlePauseToggle();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        e.stopPropagation();
        h.handleResetBlock();
      } else if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        e.stopPropagation();
        void h.endSession("abort");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

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
    <main className="relative flex h-screen flex-col overflow-hidden px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <RecordingIndicator active={recordingActive} />
        </div>
        <div className="text-center">
          <div className="text-sm text-neutral-400">{song.title}</div>
          <div className="text-xs text-neutral-600">{durationMinutes}-min session</div>
        </div>
        <div className="flex items-center gap-2">
          <MetronomeModeToggle mode={metronomeMode} onChange={setMetronomeMode} />
          <button
            type="button"
            onClick={handleResetBlock}
            disabled={!canReset}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset block
          </button>
          <button
            type="button"
            onClick={() =>
              isConscious
                ? setConsciousBpmEditorOpen(true)
                : setBpmEditorOpen(true)
            }
            disabled={!canEditBpm}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            Edit BPM
          </button>
          <button
            type="button"
            onClick={handlePauseToggle}
            disabled={!canPause && !paused}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              paused
                ? "border-accent bg-accent text-black hover:bg-accent-strong"
                : "border-bg-border text-neutral-200 hover:border-accent hover:text-neutral-100"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <PreviousBlockButton
            onClick={handlePrevious}
            disabled={snap.blockIndex === 0 || paused}
          />
          <SkipBlockButton onClick={handleSkip} />
          <button
            onClick={() => void endSession("abort")}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:border-red-900 hover:text-red-300"
          >
            End
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 pt-2">
        {currentBlock && (
          <BlockHeader
            label={blockLabelWithTroubleIndex(currentBlock, blocks)}
            tempoBpm={tempoBpm}
            blockIndex={snap.blockIndex}
            totalBlocks={blocks.length}
          />
        )}

        <MetronomeIndicator metronome={metronomeRef.current} />

        {isUnbounded ? (
          <BlockCountUp seconds={elapsedSec} />
        ) : (
          <BlockCountdown seconds={timeLeftSec} />
        )}

        {currentBlock && <BlockInstructions items={currentBlock.instructions} />}
      </div>

      <div className="flex w-full shrink-0 flex-col items-center justify-center gap-3 pt-2">
        {isConscious && snap.phase === "playing" && !paused && (
          <div className="flex items-center gap-2">
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
        )}

        {awaiting ? (
          <button
            onClick={advance}
            className="rounded-xl bg-accent px-10 py-5 text-2xl font-bold text-black shadow-lg transition hover:bg-accent-strong"
          >
            Continue → {nextBlock ? nextBlock.label : "Finish"}
            <span className="ml-3 text-sm font-normal opacity-70">(Space)</span>
          </button>
        ) : isUnbounded ? (
          <button
            onClick={advance}
            className="rounded-xl bg-accent px-10 py-5 text-2xl font-bold text-black shadow-lg transition hover:bg-accent-strong"
          >
            Finish warm-up → {nextBlock ? nextBlock.label : "Finish"}
            <span className="ml-3 text-sm font-normal opacity-70">(Space)</span>
          </button>
        ) : (
          <EarnedButton
            onClick={handleEarned}
            disabled={!showEarnedButton}
            hint={
              showEarnedButton
                ? undefined
                : "Only active during Ceiling Work and Trouble Spot blocks"
            }
          />
        )}
      </div>

      <div className="shrink-0 pt-3">
        <ShortcutsHint />
      </div>

      {paused && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-bg/60 pt-24 backdrop-blur-[2px]">
          <div className="pointer-events-none text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Paused
            </div>
            <div className="mt-3 text-5xl font-bold text-accent">⏸</div>
            <div className="mt-3 text-xs uppercase tracking-wider text-neutral-500">
              Press <span className="font-mono text-neutral-300">P</span> or
              click Resume to continue
            </div>
          </div>
        </div>
      )}

      {awaiting && !paused && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-bg/50 pt-24 backdrop-blur-[2px]">
          <div className="pointer-events-none text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Finish your pass — then press Space
            </div>
            {nextBlock && (
              <>
                <div className="mt-3 text-xs uppercase tracking-wider text-neutral-500">
                  Up next
                </div>
                <div className="mt-1 text-4xl font-semibold text-neutral-100">
                  {blockLabelWithTroubleIndex(nextBlock, blocks)}
                </div>
                <div className="mt-2 font-mono text-5xl font-bold text-accent tabular-nums">
                  {nextBlock.tempoFn(songRuntimeRef.current ?? song)}
                  <span className="ml-2 text-xl text-neutral-400">BPM</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
          helperText={`Saved to this song. Default is ${consciousDefaultBpm} (⅓ × ${song.workingBpm}).`}
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

      <div className="pointer-events-none fixed bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-black shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>
    </main>
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
