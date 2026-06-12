"use client";

import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { BlockDef, DriverSnapshot } from "@/types/block";
import type { SessionRecord } from "@/types/sessionRecord";
import { SessionRecorder } from "@/lib/audio/recorder";
import {
  Metronome,
  type MetronomeMode,
} from "@/lib/metronome/scheduler";
import type { TempoSubject } from "@/lib/session/runtimeTypes";
import {
  advanceSnapshot,
  elapsedInPlayingSec,
  initialSnapshot,
  repeatCurrentBlockSnapshot,
  rewindSnapshot,
  tickSnapshot,
  timeLeftInPlayingSec,
} from "@/lib/session/driver";

const AUTO_ADVANCE_DELAY_MS = 1000;

type PracticeSessionSettings = {
  recordingEnabled: boolean;
  metronomeVolume: number;
  accentsEnabled: boolean;
  autoAdvanceBlocks: boolean;
};

export type PracticeSessionConfig<TItem> = {
  item: TItem;
  itemId: string;
  itemTitle: string;
  itemKind: "song" | "exercise";
  blocks: BlockDef[];
  runtimeSubject: TempoSubject;
  setRuntimeSubject: (next: TempoSubject) => void;
  updateItem: (next: TItem) => Promise<void>;
  buildRecord: (args: {
    durationSec: number;
    reason: "complete" | "abort";
  }) => SessionRecord;
  afterCompleteRoute: () => string | null;
  detailRoute: string;
};

type FinishSessionArgs = {
  elapsedSec: number;
  startedAt: string;
  recorder: SessionRecorder | null;
};

type UsePracticeSessionArgs = {
  blocks: BlockDef[];
  runtimeSubjectRef: MutableRefObject<TempoSubject | null>;
  settings: PracticeSessionSettings;
  metronomeMode: MetronomeMode;
  clearLatestRecording: () => void;
  getStartSubject: () => TempoSubject | null;
  onBeforeStart?: (subject: TempoSubject) => void;
  onSessionStarted?: (startMs: number, subject: TempoSubject) => void;
  onBlockStarted?: (block: BlockDef) => void;
  onRecordingError?: () => void;
  onComplete: () => void;
  onAbort: () => void;
  onPlus?: () => void;
  isIntermissionActive?: () => boolean;
  onIntermissionSkip?: () => void;
  onIntermissionCancel?: () => void;
  onIntermissionPauseToggle?: () => void;
  metronomeSuppressed?: boolean;
  createMetronomeWhenSilent?: boolean;
};

export function usePracticeSession({
  blocks,
  runtimeSubjectRef,
  settings,
  metronomeMode,
  clearLatestRecording,
  getStartSubject,
  onBeforeStart,
  onSessionStarted,
  onBlockStarted,
  onRecordingError,
  onComplete,
  onAbort,
  onPlus,
  isIntermissionActive,
  onIntermissionSkip,
  onIntermissionCancel,
  onIntermissionPauseToggle,
  metronomeSuppressed = false,
  createMetronomeWhenSilent = false,
}: UsePracticeSessionArgs) {
  const [started, setStarted] = useState(false);
  const [metronomeModeState, setMetronomeModeState] =
    useState<MetronomeMode>(metronomeMode);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [paused, setPaused] = useState(false);
  const [snap, setSnap] = useState<DriverSnapshot | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [recordingActive, setRecordingActive] = useState(false);

  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const pausedAtRef = useRef<number>(0);
  const sessionStartMsRef = useRef<number>(0);
  const sessionStartIsoRef = useRef<string>("");
  const metronomeRef = useRef<Metronome | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const endedRef = useRef(false);
  const startingRef = useRef(false);
  const prevPhaseKeyRef = useRef<string>("");
  const startedRef = useRef(started);
  startedRef.current = started;

  const autoAdvanceRef = useRef(settings.autoAdvanceBlocks);
  autoAdvanceRef.current = settings.autoAdvanceBlocks;

  useEffect(() => {
    setMetronomeModeState(metronomeMode);
  }, [metronomeMode]);

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

  const advance = useCallback(() => {
    setSnap((prev) => {
      if (!prev) return prev;
      return advanceSnapshot(prev, blocks, Date.now());
    });
  }, [blocks]);

  useEffect(() => {
    if (!started || !snap || endedRef.current) return;
    const key = `${snap.phase}-${snap.blockIndex}`;
    if (key === prevPhaseKeyRef.current) return;
    prevPhaseKeyRef.current = key;

    if (snap.phase === "ended") {
      onComplete();
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
      const subject = runtimeSubjectRef.current;
      if (!block || !subject) return;
      onBlockStarted?.(block);
      if (block.metronomeEnabled === false) {
        m.pause();
      } else {
        m.resume();
        m.setBpm(block.tempoFn(subject));
        m.alignToDownbeat();
      }
    }
  }, [snap, started, blocks, advance, onBlockStarted, onComplete, runtimeSubjectRef]);

  useEffect(() => {
    metronomeRef.current?.setVolume(settings.metronomeVolume);
    metronomeRef.current?.setAccentsEnabled(settings.accentsEnabled);
  }, [settings.metronomeVolume, settings.accentsEnabled]);

  useEffect(() => {
    metronomeRef.current?.setMode(metronomeModeState);
  }, [metronomeModeState]);

  const startSession = useCallback(async () => {
    if (started || startingRef.current) return;
    const subject = getStartSubject();
    if (!subject) return;
    const firstBlock = blocks[0];
    if (!firstBlock) return;
    startingRef.current = true;

    clearLatestRecording();
    onBeforeStart?.(subject);

    const prev = metronomeRef.current;
    if (prev) {
      prev.stop();
      prev.dispose();
      metronomeRef.current = null;
    }

    const anyMetronome =
      !metronomeSuppressed && blocks.some((b) => b.metronomeEnabled !== false);
    if (!metronomeSuppressed && (createMetronomeWhenSilent || anyMetronome)) {
      const m = new Metronome();
      m.setVolume(settings.metronomeVolume);
      m.setAccentsEnabled(settings.accentsEnabled);
      metronomeRef.current = m;

      if (anyMetronome) {
        const firstBpm = firstBlock.tempoFn(subject);
        void m.start(firstBpm, metronomeModeState).then(() => {
          if (firstBlock.metronomeEnabled === false) m.pause();
        }).catch(() => {
          // A later tempo change can retry after the user resolves audio setup.
        });
      }
    }

    if (settings.recordingEnabled) {
      const rec = new SessionRecorder();
      try {
        await rec.start();
        recorderRef.current = rec;
        setRecordingActive(true);
      } catch (err) {
        recorderRef.current = null;
        setRecordingActive(false);
        if (onRecordingError) {
          onRecordingError();
        } else {
          addToast("Recording disabled - mic permission denied.");
        }
        void err;
      }
    }

    const startMs = Date.now();
    sessionStartMsRef.current = startMs;
    sessionStartIsoRef.current = new Date(startMs).toISOString();
    prevPhaseKeyRef.current = "playing-0";
    endedRef.current = false;
    onSessionStarted?.(startMs, subject);
    setSnap(initialSnapshot(startMs));
    setNowMs(startMs);
    setStarted(true);
  }, [
    blocks,
    clearLatestRecording,
    createMetronomeWhenSilent,
    getStartSubject,
    addToast,
    metronomeModeState,
    metronomeSuppressed,
    onBeforeStart,
    onRecordingError,
    onSessionStarted,
    settings.accentsEnabled,
    settings.metronomeVolume,
    settings.recordingEnabled,
    started,
  ]);

  const finishSession = useCallback(
    async (
      reason: "complete" | "abort",
      afterStop: (args: FinishSessionArgs) => Promise<void> | void,
    ) => {
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

      const recorder = recorderRef.current;
      recorderRef.current = null;
      setRecordingActive(false);

      await afterStop({
        elapsedSec,
        startedAt: sessionStartIsoRef.current,
        recorder,
      });
    },
    [],
  );

  const handleSkip = useCallback(() => {
    if (!snap || snap.phase === "ended") return;
    if (pausedRef.current) return;
    advance();
  }, [snap, advance]);

  const handleRepeatBlock = useCallback(() => {
    if (!snap) return;
    if (pausedRef.current) return;
    setSnap((prev) =>
      prev ? repeatCurrentBlockSnapshot(prev, blocks, Date.now()) : prev,
    );
  }, [snap, blocks]);

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

  const handleResetBlock = useCallback(() => {
    if (!snap || snap.phase !== "playing") return;
    if (pausedRef.current) return;
    const now = Date.now();
    setSnap((s) => (s ? { ...s, blockStartMs: now } : s));
    metronomeRef.current?.alignToDownbeat();
    addToast("Block reset");
  }, [snap, addToast]);

  const repeatCurrentBlockFromEnded = useCallback(() => {
    endedRef.current = false;
    prevPhaseKeyRef.current = "";
    setSnap((prev) =>
      prev ? repeatCurrentBlockSnapshot(prev, blocks, Date.now()) : prev,
    );
  }, [blocks]);

  const keyboardHandlersRef = useRef({
    handleSpace: advance,
    handlePlus: onPlus,
    handlePauseToggle,
    handleResetBlock,
    onAbort,
    isIntermissionActive,
    onIntermissionSkip,
    onIntermissionCancel,
    onIntermissionPauseToggle,
  });
  keyboardHandlersRef.current = {
    handleSpace: advance,
    handlePlus: onPlus,
    handlePauseToggle,
    handleResetBlock,
    onAbort,
    isIntermissionActive,
    onIntermissionSkip,
    onIntermissionCancel,
    onIntermissionPauseToggle,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!startedRef.current) return;
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      const h = keyboardHandlersRef.current;

      if (h.isIntermissionActive?.()) {
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          h.onIntermissionSkip?.();
        } else if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          e.stopPropagation();
          h.onIntermissionPauseToggle?.();
        } else if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          e.stopPropagation();
          h.onIntermissionCancel?.();
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
        h.handlePlus?.();
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
        h.onAbort();
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

  const currentBlock = snap ? blocks[snap.blockIndex] : undefined;
  const nextBlock = snap ? blocks[snap.blockIndex + 1] : undefined;
  const timeLeftSec =
    snap && currentBlock ? timeLeftInPlayingSec(snap, blocks, nowMs) : 0;
  const elapsedSec = snap ? elapsedInPlayingSec(snap, nowMs) : 0;
  const awaiting = snap?.phase === "awaiting";

  return {
    started,
    snap,
    setSnap,
    nowMs,
    paused,
    pausedRef,
    startedRef,
    startingRef,
    sessionStartMsRef,
    sessionStartIsoRef,
    metronomeRef,
    recorderRef,
    endedRef,
    currentBlock,
    nextBlock,
    timeLeftSec,
    elapsedSec,
    awaiting,
    recordingActive,
    metronomeMode: metronomeModeState,
    setMetronomeMode: setMetronomeModeState,
    toasts,
    addToast,
    startSession,
    finishSession,
    advance,
    handleSkip,
    handleRepeatBlock,
    handlePrevious,
    handlePauseToggle,
    handleResetBlock,
    repeatCurrentBlockFromEnded,
  };
}
