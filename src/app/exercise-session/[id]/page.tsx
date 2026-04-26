"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
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
import { buildExerciseBlocks } from "@/lib/session/exerciseBlocks";
import { exerciseAsSong } from "@/lib/session/exerciseAdapter";
import { nowIso, promoteWorking, warmupBpmFor } from "@/lib/session/tempo";
import type { Exercise } from "@/types/exercise";
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

type BetweenItems = {
  nextItemId: string;
  nextItemTitle: string;
  startedAtMs: number;
  durationSec: number;
};

const AUTO_ADVANCE_DELAY_MS = 1000;

export default function ExerciseSessionPage() {
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

  const exercises = useExercisesStore((s) => s.exercises);
  const loadedExercises = useExercisesStore((s) => s.loaded);
  const loadExercises = useExercisesStore((s) => s.load);
  const exercise = useExercisesStore((s) =>
    s.exercises.find((x) => x.id === id),
  );
  const updateExercise = useExercisesStore((s) => s.updateExercise);
  const incrementPracticeTime = useExercisesStore(
    (s) => s.incrementPracticeTime,
  );

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
  const [betweenItems, setBetweenItems] = useState<BetweenItems | null>(null);
  const [betweenItemsPaused, setBetweenItemsPaused] = useState(false);
  const [bpmEditorOpen, setBpmEditorOpen] = useState(false);
  const [consciousSlowMode, setConsciousSlowMode] = useState(false);
  const [consciousBpmEditorOpen, setConsciousBpmEditorOpen] = useState(false);

  const [snap, setSnap] = useState<DriverSnapshot | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const pausedAtRef = useRef<number>(0);
  const betweenItemsRef = useRef<BetweenItems | null>(null);
  betweenItemsRef.current = betweenItems;
  const betweenItemsPausedRef = useRef(false);
  betweenItemsPausedRef.current = betweenItemsPaused;
  const betweenItemsPausedAtRef = useRef<number>(0);

  const sessionStartMsRef = useRef<number>(0);
  const sessionStartIsoRef = useRef<string>("");
  const startWorkingBpmRef = useRef<number>(0);
  const promotionsRef = useRef<PromotionEvent[]>([]);
  // Runtime exercise (in Song-shape, for tempoFn). Promotion mutates this in
  // place via a fresh object; the underlying Exercise is rebuilt and saved
  // separately so the store stays canonical.
  const runtimeSongRef = useRef<Song | null>(null);
  const exerciseRef = useRef<Exercise | null>(null);
  const metronomeRef = useRef<Metronome | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const recordingActiveRef = useRef(false);
  const endedRef = useRef(false);
  const [recordingActive, setRecordingActive] = useState(false);

  const autoAdvanceRef = useRef(settings.autoAdvanceBlocks);
  autoAdvanceRef.current = settings.autoAdvanceBlocks;

  useEffect(() => {
    if (!loadedExercises) void loadExercises();
    if (!loadedSettings) void loadSettings();
  }, [loadedExercises, loadExercises, loadedSettings, loadSettings]);

  useEffect(() => {
    if (exercise) {
      exerciseRef.current = exercise;
      runtimeSongRef.current = exerciseAsSong(exercise);
    }
  }, [exercise]);

  // Block list scales with the exercise's saved sessionMinutes (or, when
  // openEnded, collapses to a single unbounded block). Re-derive when the
  // saved value changes — rare, but be safe.
  const sessionMinutes = exercise?.sessionMinutes ?? 5;
  const isOpenEnded = !!exercise?.openEnded;
  const metronomeOff = exercise ? exercise.metronomeEnabled === false : false;
  const blocks = useMemo<BlockDef[]>(
    () => (exercise ? buildExerciseBlocks(exercise) : []),
    // Inputs that affect the block list. The exercise object identity changes
    // on every store update, so depend on the specific fields instead to
    // avoid rebuilding blocks every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise?.id, isOpenEnded, sessionMinutes],
  );

  const addToast = useCallback((text: string) => {
    const toastId = Date.now() + Math.random();
    setToasts((t) => [...t, { id: toastId, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 2200);
  }, []);

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

      if (pausedAtRef.current > 0) {
        sessionStartMsRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = 0;
      }

      const elapsedSec = sessionStartMsRef.current
        ? (Date.now() - sessionStartMsRef.current) / 1000
        : 0;

      const m = metronomeRef.current;
      if (m) {
        m.stop();
        m.dispose();
        metronomeRef.current = null;
      }

      const exId = exercise?.id;
      if (exId) {
        void incrementPracticeTime(exId, Math.max(0, elapsedSec));
      }

      if (exId && sessionStartIsoRef.current) {
        const exNow = exerciseRef.current ?? exercise;
        const rec: SessionRecord = {
          id: genSessionRecordId(),
          itemId: exId,
          itemKind: "exercise",
          itemTitle: exercise?.name ?? exId,
          startedAt: sessionStartIsoRef.current,
          endedAt: new Date().toISOString(),
          durationSec: Math.max(0, Math.round(elapsedSec)),
          endedReason: reason,
          plannedMinutes: exercise?.sessionMinutes ?? sessionMinutes,
          startWorkingBpm: startWorkingBpmRef.current,
          endWorkingBpm: exNow?.workingBpm ?? startWorkingBpmRef.current,
          startTroubleBpms: [],
          endTroubleBpms: [],
          promotions: promotionsRef.current.slice(),
        };
        void appendSessionRecord(rec).catch(() => {
          // best-effort
        });
      }

      const rec = recorderRef.current;
      if (rec && exId) {
        try {
          const result = await rec.stop();
          const blobUrl = URL.createObjectURL(result.blob);
          setLatestRecording({
            // Recording is keyed by id only — exercises and songs share the
            // single-slot store and the detail page filters by matching id.
            songId: exId,
            blob: result.blob,
            blobUrl,
            durationSec: result.durationSec,
            durationMinutes: exerciseRef.current?.sessionMinutes ?? 5,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // swallow
        }
      }
      recorderRef.current = null;

      // On a normal completion, flow into the next exercise in the user's
      // ordered list. Mirrors the song session's between-songs behavior.
      if (reason === "complete" && exId) {
        const idx = exercises.findIndex((x) => x.id === exId);
        const next = idx >= 0 ? exercises[idx + 1] : undefined;
        if (next) {
          const pauseSec = Math.max(0, settings.interSongPauseSec);
          if (pauseSec > 0) {
            setBetweenItems({
              nextItemId: next.id,
              nextItemTitle: next.name,
              startedAtMs: Date.now(),
              durationSec: pauseSec,
            });
            return;
          }
          router.push(`/exercise-session/${next.id}`);
          return;
        }
      }

      if (exId) router.push(`/exercises/${exId}`);
      else router.push("/");
    },
    [
      exercise,
      exercises,
      incrementPracticeTime,
      router,
      setLatestRecording,
      appendSessionRecord,
      sessionMinutes,
      settings.interSongPauseSec,
    ],
  );

  const advance = useCallback(() => {
    setSnap((prev) => {
      if (!prev) return prev;
      return advanceSnapshot(prev, blocks, Date.now());
    });
  }, [blocks]);

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
      m.playTransitionCue();
      if (autoAdvanceRef.current) {
        const t = setTimeout(() => advance(), AUTO_ADVANCE_DELAY_MS);
        return () => clearTimeout(t);
      }
      return;
    }

    if (snap.phase === "playing") {
      const block = blocks[snap.blockIndex];
      const songNow = runtimeSongRef.current;
      if (!block || !songNow) return;
      if (block.kind !== "consciousPractice") {
        setConsciousSlowMode(false);
      }
      m.setBpm(block.tempoFn(songNow));
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
    if (!exercise || started || startingRef.current) return;
    startingRef.current = true;

    clearLatestRecording();
    exerciseRef.current = exercise;
    runtimeSongRef.current = exerciseAsSong(exercise);

    const prev = metronomeRef.current;
    if (prev) {
      prev.stop();
      prev.dispose();
      metronomeRef.current = null;
    }

    // Skip the metronome entirely when this exercise has it disabled
    // (e.g. transcribing). The session still runs — just silently.
    if (!metronomeOff) {
      const m = new Metronome();
      m.setVolume(settings.metronomeVolume);
      m.setAccentsEnabled(settings.accentsEnabled);
      metronomeRef.current = m;

      const firstBlock = blocks[0];
      const firstBpm = firstBlock.tempoFn(runtimeSongRef.current);
      try {
        await m.start(firstBpm, metronomeMode);
      } catch {
        // swallow — next BPM change will retry
      }
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
    startWorkingBpmRef.current = exercise.workingBpm;
    promotionsRef.current = [];
    prevPhaseKeyRef.current = "playing-0";
    setSnap(initialSnapshot(startMs));
    setNowMs(startMs);
    setStarted(true);
  }, [
    exercise,
    started,
    blocks,
    metronomeMode,
    settings.metronomeVolume,
    settings.recordingEnabled,
    settings.accentsEnabled,
    clearLatestRecording,
    addToast,
  ]);

  useEffect(() => {
    if (!loadedExercises || !loadedSettings) return;
    if (!exercise) return;
    if (started || startingRef.current) return;
    const t = setTimeout(() => {
      void startSession();
    }, 0);
    return () => clearTimeout(t);
  }, [loadedExercises, loadedSettings, exercise, started, startSession]);

  const currentBlock = snap ? blocks[snap.blockIndex] : undefined;
  const nextBlock = snap ? blocks[snap.blockIndex + 1] : undefined;

  const tempoBpm = useMemo(() => {
    if (!currentBlock) return 0;
    const s = runtimeSongRef.current;
    if (!s) return 0;
    if (currentBlock.kind === "consciousPractice" && consciousSlowMode) {
      return Math.max(20, Math.floor(warmupBpmFor(s) / 2));
    }
    return currentBlock.tempoFn(s);
  }, [currentBlock, exercise, consciousSlowMode]);

  // Push tempoBpm to the live metronome while in the warm-up block. Mirrors
  // the song session: warm-up BPM changes via the saved warmupBpm field or
  // the slow-mode toggle, neither of which goes through the phase-transition
  // setBpm path.
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
  const consciousPlayedBpm = currentBlock ? tempoBpm : 0;
  const consciousDefaultBpm = exercise
    ? Math.max(20, Math.round(exercise.workingBpm / 3))
    : 0;
  const consciousSlowerBpm = runtimeSongRef.current
    ? Math.max(20, Math.floor(warmupBpmFor(runtimeSongRef.current) / 2))
    : 0;
  const consciousIsSlower = isConscious && consciousSlowMode;
  const consciousIsDefault =
    isConscious && !consciousSlowMode && (exercise?.warmupBpm ?? null) == null;

  const bpmEditorState = useMemo(() => {
    if (!currentBlock) return null;
    const songNow = runtimeSongRef.current;
    if (!songNow) return null;
    const playedBpm = currentBlock.tempoFn(songNow);
    const isDerived = playedBpm !== songNow.workingBpm;
    return {
      title: "Edit Working BPM",
      helperText: isDerived
        ? `This block plays at ${playedBpm} BPM (derived from working ${songNow.workingBpm}).`
        : `This block plays at ${playedBpm} BPM.`,
      initialBpm: songNow.workingBpm,
    };
  }, [currentBlock, exercise]);

  const handleEarned = useCallback(async () => {
    if (!snap || snap.phase !== "playing") return;
    const block = blocks[snap.blockIndex];
    const songNow = runtimeSongRef.current;
    const exNow = exerciseRef.current;
    if (!block || !songNow || !exNow || !block.showEarnedButton) return;
    if (block.promotes?.kind !== "working") return;

    const oldBpm = exNow.workingBpm;
    const promotedSong = promoteWorking(songNow);
    const promotedExercise: Exercise = {
      ...exNow,
      workingBpm: promotedSong.workingBpm,
      updatedAt: nowIso(),
    };
    runtimeSongRef.current = promotedSong;
    exerciseRef.current = promotedExercise;
    metronomeRef.current?.setBpm(block.tempoFn(promotedSong));
    promotionsRef.current.push({
      at: nowIso(),
      kind: "working",
      fromBpm: oldBpm,
      toBpm: promotedExercise.workingBpm,
      stepPercent: exNow.stepPercent,
    });
    addToast(`Working: ${oldBpm} → ${promotedExercise.workingBpm}`);
    await updateExercise(promotedExercise);
  }, [snap, blocks, updateExercise, addToast]);

  const handleSkip = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    advance();
  }, [snap, advance]);

  const handlePrevious = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    if (snap.blockIndex === 0) return;
    setSnap((prev) =>
      prev ? rewindSnapshot(prev, blocks, Date.now()) : prev,
    );
  }, [snap, blocks]);

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

  const handleEditBpm = useCallback(
    async (newBpm: number) => {
      if (!snap || snap.phase !== "playing") return;
      const block = blocks[snap.blockIndex];
      const songNow = runtimeSongRef.current;
      const exNow = exerciseRef.current;
      if (!block || !songNow || !exNow) return;

      const oldBpm = exNow.workingBpm;
      const updatedSong: Song = {
        ...songNow,
        workingBpm: newBpm,
        updatedAt: nowIso(),
      };
      const updatedExercise: Exercise = {
        ...exNow,
        workingBpm: newBpm,
        updatedAt: nowIso(),
      };
      runtimeSongRef.current = updatedSong;
      exerciseRef.current = updatedExercise;
      metronomeRef.current?.setBpm(block.tempoFn(updatedSong));
      setBpmEditorOpen(false);
      addToast(`Working: ${oldBpm} → ${newBpm}`);
      await updateExercise(updatedExercise);
    },
    [snap, blocks, updateExercise, addToast],
  );

  const handleResetBlock = useCallback(() => {
    if (!snap || snap.phase !== "playing") return;
    if (pausedRef.current) return;
    const now = Date.now();
    setSnap((s) => (s ? { ...s, blockStartMs: now } : s));
    metronomeRef.current?.alignToDownbeat();
    addToast("Block reset");
  }, [snap, addToast]);

  // Skip the inter-item countdown — route to the next exercise immediately.
  const handleBetweenItemsSkip = useCallback(() => {
    const b = betweenItemsRef.current;
    if (!b) return;
    router.push(`/exercise-session/${b.nextItemId}`);
  }, [router]);

  const handleBetweenItemsCancel = useCallback(() => {
    if (!betweenItemsRef.current) return;
    router.push("/");
  }, [router]);

  // Pause / resume the inter-item countdown. Mirrors the block-pause shape.
  const handleBetweenItemsPauseToggle = useCallback(() => {
    const current = betweenItemsRef.current;
    if (!current) return;
    if (betweenItemsPausedRef.current) {
      const delta = Date.now() - betweenItemsPausedAtRef.current;
      betweenItemsPausedAtRef.current = 0;
      setBetweenItems({ ...current, startedAtMs: current.startedAtMs + delta });
      setBetweenItemsPaused(false);
    } else {
      betweenItemsPausedAtRef.current = Date.now();
      setBetweenItemsPaused(true);
    }
  }, []);

  // Auto-route when the inter-item countdown hits 0.
  useEffect(() => {
    if (!betweenItems) return;
    if (betweenItemsPaused) return;
    const remainingMs = Math.max(
      0,
      betweenItems.startedAtMs + betweenItems.durationSec * 1000 - Date.now(),
    );
    const t = setTimeout(() => {
      router.push(`/exercise-session/${betweenItems.nextItemId}`);
    }, remainingMs);
    return () => clearTimeout(t);
  }, [betweenItems, betweenItemsPaused, router]);

  const handleSpace = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    advance();
  }, [snap, advance]);

  const handlePlus = useCallback(() => {
    if (!snap || snap.phase !== "playing") return;
    if (pausedRef.current) return;
    const block = blocks[snap.blockIndex];
    if (!block?.showEarnedButton) return;
    void handleEarned();
  }, [snap, blocks, handleEarned]);

  const startedRef = useRef(started);
  startedRef.current = started;
  const keyHandlersRef = useRef({
    handleSpace,
    handlePlus,
    handleSkip,
    handlePauseToggle,
    handleResetBlock,
    handleBetweenItemsSkip,
    handleBetweenItemsCancel,
    handleBetweenItemsPauseToggle,
    endSession,
  });
  keyHandlersRef.current = {
    handleSpace,
    handlePlus,
    handleSkip,
    handlePauseToggle,
    handleResetBlock,
    handleBetweenItemsSkip,
    handleBetweenItemsCancel,
    handleBetweenItemsPauseToggle,
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

      // Inter-item countdown has its own lean keymap.
      if (betweenItemsRef.current) {
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          h.handleBetweenItemsSkip();
        } else if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          e.stopPropagation();
          h.handleBetweenItemsPauseToggle();
        } else if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          e.stopPropagation();
          h.handleBetweenItemsCancel();
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

  if (!loadedExercises || !loadedSettings) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Loading...
      </main>
    );
  }

  if (!exercise) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-bold">Exercise not found</h1>
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

  if (betweenItems) {
    const effectiveNowMs = betweenItemsPaused
      ? betweenItemsPausedAtRef.current
      : nowMs;
    const elapsedMs = effectiveNowMs - betweenItems.startedAtMs;
    const remainingSec = Math.max(
      0,
      Math.ceil(betweenItems.durationSec - elapsedMs / 1000),
    );
    return (
      <BetweenItemsOverlay
        nextItemTitle={betweenItems.nextItemTitle}
        remainingSec={remainingSec}
        paused={betweenItemsPaused}
        onSkip={handleBetweenItemsSkip}
        onCancel={handleBetweenItemsCancel}
        onPauseToggle={handleBetweenItemsPauseToggle}
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
          <div className="text-sm text-neutral-400">{exercise.name}</div>
          <div className="text-xs text-neutral-600">
            {isOpenEnded ? "Open-ended" : `${sessionMinutes}-min exercise`}
            {metronomeOff ? " · metronome off" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!metronomeOff && (
            <MetronomeModeToggle mode={metronomeMode} onChange={setMetronomeMode} />
          )}
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
            label={currentBlock.label}
            tempoBpm={tempoBpm}
            blockIndex={snap.blockIndex}
            totalBlocks={blocks.length}
          />
        )}

        {!metronomeOff && <MetronomeIndicator metronome={metronomeRef.current} />}

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
                const exNow = exerciseRef.current;
                if (!exNow || exNow.warmupBpm == null) return;
                const cleared: Exercise = {
                  ...exNow,
                  warmupBpm: null,
                  updatedAt: nowIso(),
                };
                exerciseRef.current = cleared;
                runtimeSongRef.current = exerciseAsSong(cleared);
                void updateExercise(cleared);
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
            onClick={() =>
              currentBlock?.kind === "openEnded"
                ? void endSession("complete")
                : advance()
            }
            className="rounded-xl bg-accent px-10 py-5 text-2xl font-bold text-black shadow-lg transition hover:bg-accent-strong"
          >
            {currentBlock?.kind === "openEnded"
              ? "End session"
              : `Finish warm-up → ${nextBlock ? nextBlock.label : "Finish"}`}
            <span className="ml-3 text-sm font-normal opacity-70">
              {currentBlock?.kind === "openEnded" ? "(Esc)" : "(Space)"}
            </span>
          </button>
        ) : (
          <EarnedButton
            onClick={handleEarned}
            disabled={!showEarnedButton}
            hint={
              showEarnedButton
                ? undefined
                : "Only active during the Build block"
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
                  {nextBlock.label}
                </div>
                <div className="mt-2 font-mono text-5xl font-bold text-accent tabular-nums">
                  {nextBlock.tempoFn(runtimeSongRef.current ?? exerciseAsSong(exercise))}
                  <span className="ml-2 text-xl text-neutral-400">BPM</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {bpmEditorState && (
        <BpmEditorModal
          open={bpmEditorOpen}
          title={bpmEditorState.title}
          helperText={bpmEditorState.helperText}
          initialBpm={bpmEditorState.initialBpm}
          onSave={(n) => void handleEditBpm(n)}
          onCancel={() => setBpmEditorOpen(false)}
        />
      )}

      {isConscious && (
        <BpmEditorModal
          open={consciousBpmEditorOpen}
          title="Conscious Practice BPM"
          helperText={`Saved to this exercise. Default is ${consciousDefaultBpm} (⅓ × ${exercise.workingBpm}).`}
          initialBpm={consciousPlayedBpm}
          onSave={(n) => {
            const clamped = Math.max(20, n);
            const exNow = exerciseRef.current;
            if (!exNow) return;
            const updated: Exercise = {
              ...exNow,
              warmupBpm: clamped,
              updatedAt: nowIso(),
            };
            exerciseRef.current = updated;
            runtimeSongRef.current = exerciseAsSong(updated);
            setConsciousSlowMode(false);
            setConsciousBpmEditorOpen(false);
            void updateExercise(updated);
          }}
          onCancel={() => setConsciousBpmEditorOpen(false)}
          onReset={
            exercise.warmupBpm != null
              ? () => {
                  const exNow = exerciseRef.current;
                  if (!exNow) return;
                  const cleared: Exercise = {
                    ...exNow,
                    warmupBpm: null,
                    updatedAt: nowIso(),
                  };
                  exerciseRef.current = cleared;
                  runtimeSongRef.current = exerciseAsSong(cleared);
                  setConsciousSlowMode(false);
                  setConsciousBpmEditorOpen(false);
                  void updateExercise(cleared);
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
