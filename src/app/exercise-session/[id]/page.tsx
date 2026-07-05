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
  enableMetronomeDebug,
} from "@/lib/metronome/scheduler";
import { buildExerciseBlockPlan } from "@/lib/session/exerciseBlocks";
import { exerciseAsSong } from "@/lib/session/exerciseAdapter";
import { nowIso, promoteWorking, warmupBpmFor } from "@/lib/session/tempo";
import { usePracticeSession } from "@/lib/session/usePracticeSession";
import {
  buildExerciseSessionRecord,
  buildLatestRecording,
  intermissionRemainingSec,
  resumeIntermission,
} from "@/lib/session/sessionArtifacts";
import { setActiveHomeTab } from "@/lib/ui/activeTab";
import type { Exercise } from "@/types/exercise";
import type { Song } from "@/types/song";
import type { BlockDef } from "@/types/block";

import { MetronomeDiagnosticsPanel } from "@/components/session/MetronomeDiagnostics";
import { BpmEditorModal } from "@/components/session/BpmEditorModal";
import { BetweenItemsOverlay } from "@/components/session/BetweenItemsOverlay";
import { SessionShell } from "@/components/session/SessionShell";

type BetweenItems = {
  nextItemId: string;
  nextItemTitle: string;
  startedAtMs: number;
  durationSec: number;
};

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

  const settings = useSettingsStore((s) => s.settings);
  const loadedSettings = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);

  const setLatestRecording = useSessionStore((s) => s.setLatestRecording);
  const clearLatestRecording = useSessionStore((s) => s.clearLatestRecording);

  const completeSessionRecord = useSessionHistoryStore((s) => s.complete);

  const [betweenItems, setBetweenItems] = useState<BetweenItems | null>(null);
  const [betweenItemsPaused, setBetweenItemsPaused] = useState(false);
  const [bpmEditorOpen, setBpmEditorOpen] = useState(false);
  const [consciousSlowMode, setConsciousSlowMode] = useState(false);
  const [consciousBpmEditorOpen, setConsciousBpmEditorOpen] = useState(false);
  const betweenItemsRef = useRef<BetweenItems | null>(null);
  betweenItemsRef.current = betweenItems;
  const betweenItemsPausedRef = useRef(false);
  betweenItemsPausedRef.current = betweenItemsPaused;
  const betweenItemsPausedAtRef = useRef<number>(0);
  const startWorkingBpmRef = useRef<number>(0);
  const promotionsRef = useRef<PromotionEvent[]>([]);
  // Runtime exercise (in Song-shape, for tempoFn). Promotion mutates this in
  // place via a fresh object; the underlying Exercise is rebuilt and saved
  // separately so the store stays canonical.
  const runtimeSongRef = useRef<Song | null>(null);
  const exerciseRef = useRef<Exercise | null>(null);
  const earnedHandlerRef = useRef<() => void>(() => {});
  const pendingExerciseWriteRef = useRef<Promise<void>>(Promise.resolve());
  const endSessionRef = useRef<(reason: "complete" | "abort") => void>(
    () => {},
  );
  const handleBetweenItemsSkipRef = useRef<() => void>(() => {});
  const handleBetweenItemsCancelRef = useRef<() => void>(() => {});
  const handleBetweenItemsPauseToggleRef = useRef<() => void>(() => {});

  const queueExerciseUpdate = useCallback(
    (next: Exercise) => {
      const write = updateExercise(next);
      pendingExerciseWriteRef.current = write.catch(() => undefined);
      return write;
    },
    [updateExercise],
  );

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
  const isOpenEnded =
    !!exercise?.openEnded || exercise?.practiceMode === "openEnded";
  const usesGlobalMetronomeToggle =
    isOpenEnded ||
    exercise?.practiceMode === "simple" ||
    exercise?.practiceMode === "timed";
  const metronomeOff = exercise
    ? usesGlobalMetronomeToggle && exercise.metronomeEnabled === false
    : false;
  const blockPlan = useMemo(
    () => (exercise ? buildExerciseBlockPlan(exercise) : null),
    // Inputs that affect the block list. The exercise object identity changes
    // on every store update, so depend on the specific fields instead to
    // avoid rebuilding blocks every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      exercise?.id,
      isOpenEnded,
      sessionMinutes,
      exercise?.practiceMode,
      exercise?.includeWarmupBlock,
      exercise?.blockTemplate,
      exercise?.metronomeEnabled,
    ],
  );
  const blocks = useMemo<BlockDef[]>(() => blockPlan?.blocks ?? [], [blockPlan]);

  const practice = usePracticeSession({
    blocks,
    runtimeSubjectRef: runtimeSongRef,
    settings,
    metronomeMode: "all",
    clearLatestRecording,
    getStartSubject: () => (exercise ? exerciseAsSong(exercise) : null),
    onBeforeStart: (subject) => {
      if (!exercise) return;
      exerciseRef.current = exercise;
      runtimeSongRef.current = subject as Song;
    },
    onSessionStarted: (_startMs, _subject) => {
      if (!exercise) return;
      startWorkingBpmRef.current = exercise.workingBpm;
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
    isIntermissionActive: () => !!betweenItemsRef.current,
    onIntermissionSkip: () => handleBetweenItemsSkipRef.current(),
    onIntermissionCancel: () => handleBetweenItemsCancelRef.current(),
    onIntermissionPauseToggle: () => handleBetweenItemsPauseToggleRef.current(),
    metronomeSuppressed: metronomeOff,
  });

  const endSession = useCallback(
    async (reason: "complete" | "abort") => {
      await practice.finishSession(reason, async ({ elapsedSec, startedAt, recorder }) => {
      await pendingExerciseWriteRef.current.catch(() => undefined);
      const exId = exercise?.id;
      let sessionId: string | null = null;

      if (exId && startedAt) {
        const exNow = exerciseRef.current ?? exercise;
        const rec: SessionRecord = buildExerciseSessionRecord({
          id: genSessionRecordId(),
          itemId: exId,
          itemTitle: exercise?.name ?? exId,
          startedAt,
          endedAt: new Date().toISOString(),
          elapsedSec,
          endedReason: reason,
          plannedMinutes: exercise?.sessionMinutes ?? sessionMinutes,
          startWorkingBpm: startWorkingBpmRef.current,
          endWorkingBpm: exNow?.workingBpm ?? startWorkingBpmRef.current,
          promotions: promotionsRef.current.slice(),
        });
        sessionId = rec.id;
        void completeSessionRecord(rec)
          .then(() => loadExercises())
          .catch(() => {
            // best-effort
          });
      }

      if (recorder && exId && sessionId) {
        try {
          const result = await recorder.stop();
          const blobUrl = URL.createObjectURL(result.blob);
          setLatestRecording(buildLatestRecording({
            itemKind: "exercise",
            itemId: exId,
            sessionId,
            blob: result.blob,
            blobUrl,
            durationSec: result.durationSec,
            plannedMinutes: exerciseRef.current?.sessionMinutes ?? 5,
            createdAt: new Date().toISOString(),
          }));
        } catch {
          // swallow
        }
      }

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

      setActiveHomeTab("exercises");
      if (exId) router.push(`/exercises/${exId}`);
      else router.push("/");
      });
    },
    [
      exercise,
      exercises,
      loadExercises,
      practice,
      router,
      setLatestRecording,
      completeSessionRecord,
      sessionMinutes,
      settings.interSongPauseSec,
    ],
  );
  endSessionRef.current = (reason) => {
    void endSession(reason);
  };

  useEffect(() => {
    if (!loadedExercises || !loadedSettings) return;
    if (!exercise) return;
    if (!blockPlan || !blockPlan.ok) return;
    if (practice.started || practice.startingRef.current) return;
    const t = setTimeout(() => {
      void practice.startSession();
    }, 0);
    return () => clearTimeout(t);
  }, [loadedExercises, loadedSettings, exercise, blockPlan, practice]);

  const currentBlock = practice.currentBlock;
  const nextBlock = practice.nextBlock;
  const snap = practice.snap;
  const started = practice.started;
  const paused = practice.paused;
  const nowMs = practice.nowMs;
  const metronomeRef = practice.metronomeRef;
  const addToast = practice.addToast;
  const advance = practice.advance;
  const recordingActive = practice.recordingActive;
  const metronomeMode = practice.metronomeMode;
  const setMetronomeMode = practice.setMetronomeMode;
  const toasts = practice.toasts;

  const tempoBpm = useMemo(() => {
    if (!currentBlock) return 0;
    const s = runtimeSongRef.current;
    if (!s) return 0;
    if (currentBlock.kind === "consciousPractice" && consciousSlowMode) {
      return Math.max(20, Math.floor(warmupBpmFor(s) / 2));
    }
    return currentBlock.tempoFn(s);
    // `exercise` is intentionally listed: when the store-derived exercise
    // updates after a promotion, we need to recompute `tempoBpm` even though
    // the body reads `runtimeSongRef.current` (the ref is refreshed by the
    // useEffect at lines 140–145 when `exercise` changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock, consciousSlowMode, exercise]);

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
    if (songNow.workingBpm == null) return null;
    const playedBpm = currentBlock.tempoFn(songNow);
    const isDerived = playedBpm !== songNow.workingBpm;
    return {
      title: "Edit Working BPM",
      helperText: isDerived
        ? `This block plays at ${playedBpm} BPM (derived from working ${songNow.workingBpm}).`
        : `This block plays at ${playedBpm} BPM.`,
      initialBpm: songNow.workingBpm,
    };
  }, [currentBlock]);

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
      workingBpm: promotedSong.workingBpm ?? oldBpm,
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
    await queueExerciseUpdate(promotedExercise);
  }, [snap, blocks, queueExerciseUpdate, addToast, metronomeRef]);
  earnedHandlerRef.current = () => {
    void handleEarned();
  };

  const handleSkip = practice.handleSkip;
  const handleRepeatBlock = practice.handleRepeatBlock;
  const handlePrevious = practice.handlePrevious;
  const handlePauseToggle = practice.handlePauseToggle;

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
      await queueExerciseUpdate(updatedExercise);
    },
    [snap, blocks, queueExerciseUpdate, addToast, metronomeRef],
  );

  const handleResetBlock = practice.handleResetBlock;

  // Skip the inter-item countdown — route to the next exercise immediately.
  const handleBetweenItemsSkip = useCallback(() => {
    const b = betweenItemsRef.current;
    if (!b) return;
    router.push(`/exercise-session/${b.nextItemId}`);
  }, [router]);

  const handleBetweenItemsCancel = useCallback(() => {
    if (!betweenItemsRef.current) return;
    setActiveHomeTab("exercises");
    router.push("/");
  }, [router]);

  // Pause / resume the inter-item countdown. Mirrors the block-pause shape.
  const handleBetweenItemsPauseToggle = useCallback(() => {
    const current = betweenItemsRef.current;
    if (!current) return;
    if (betweenItemsPausedRef.current) {
      const now = Date.now();
      const resumed = resumeIntermission(
        current,
        betweenItemsPausedAtRef.current,
        now,
      );
      betweenItemsPausedAtRef.current = 0;
      setBetweenItems(resumed);
      setBetweenItemsPaused(false);
    } else {
      betweenItemsPausedAtRef.current = Date.now();
      setBetweenItemsPaused(true);
    }
  }, []);
  handleBetweenItemsSkipRef.current = handleBetweenItemsSkip;
  handleBetweenItemsCancelRef.current = handleBetweenItemsCancel;
  handleBetweenItemsPauseToggleRef.current = handleBetweenItemsPauseToggle;

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
          onClick={() => {
            setActiveHomeTab("exercises");
            router.push("/");
          }}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Back to home
        </button>
      </main>
    );
  }

  if (blockPlan && !blockPlan.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
        <p className="text-sm font-semibold uppercase text-accent">
          Smart template
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          Session configuration needs attention
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          {blockPlan.message}
        </p>
        <button
          type="button"
          onClick={() => {
            setActiveHomeTab("exercises");
            router.push(`/exercises/${exercise.id}`);
          }}
          className="mt-6 w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Edit exercise
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
    const remainingSec = intermissionRemainingSec(betweenItems, effectiveNowMs);
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
    <SessionShell
      title={exercise.name}
      subtitle={`${isOpenEnded ? "Open-ended" : `${sessionMinutes}-min exercise`}${
        metronomeOff ? " · metronome off" : ""
      }`}
      currentBlock={currentBlock}
      nextBlock={nextBlock}
      tempoBpm={tempoBpm}
      nextTempoBpm={
        nextBlock
          ? nextBlock.tempoFn(runtimeSongRef.current ?? exerciseAsSong(exercise))
          : undefined
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
      showMetronomeControls={
        !metronomeOff && currentBlock?.metronomeEnabled !== false
      }
      showMetronomeIndicator={
        !metronomeOff && currentBlock?.metronomeEnabled !== false
      }
      canResetBlock={canReset}
      canEditBpm={canEditBpm}
      canPause={canPause}
      canPrevious={snap.blockIndex > 0 && !paused}
      showEarnedButton={showEarnedButton}
      earnedHint={showEarnedButton ? undefined : "Only active during the Build block"}
      unboundedActionLabel={
        currentBlock?.kind === "openEnded" ? "End session" : undefined
      }
      unboundedActionShortcut={
        currentBlock?.kind === "openEnded" ? "(Esc)" : "(Space)"
      }
      beforePrimaryControls={
        isConscious && snap.phase === "playing" && !paused ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
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
      onUnboundedAction={
        currentBlock?.kind === "openEnded"
          ? () => void endSession("complete")
          : advance
      }
      toasts={toasts}
    >
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
    </SessionShell>
  );
}
