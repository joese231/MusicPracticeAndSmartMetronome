"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useSessionStore } from "@/lib/store/useSessionStore";
import {
  useSessionHistoryStore,
  genSessionRecordId,
} from "@/lib/store/useSessionHistoryStore";
import type { SessionRecord } from "@/types/sessionRecord";
import {
  Metronome,
  unlockSharedAudioContext,
} from "@/lib/metronome/scheduler";
import { SessionRecorder } from "@/lib/audio/recorder";
import { BlockCountUp } from "@/components/session/BlockCountUp";
import { RecordingIndicator } from "@/components/session/RecordingIndicator";
import { MetronomeIndicator } from "@/components/metronome/MetronomeIndicator";
import { formatPracticeTime } from "@/lib/format";
import { FREE_PLAY_ITEM_ID, FREE_PLAY_ITEM_TITLE } from "@/lib/session/freePlay";

const DEFAULT_FREE_PLAY_BPM = 90;
const MIN_BPM = 30;
const MAX_BPM = 400;

type Phase = "setup" | "running" | "ended";

export default function FreePlayPage() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const loadedSettings = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const setLatestRecording = useSessionStore((s) => s.setLatestRecording);
  const clearLatestRecording = useSessionStore((s) => s.clearLatestRecording);
  const appendSessionRecord = useSessionHistoryStore((s) => s.append);

  const [phase, setPhase] = useState<Phase>("setup");
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [bpmInput, setBpmInput] = useState<string>(String(DEFAULT_FREE_PLAY_BPM));
  const [activeBpm, setActiveBpm] = useState<number>(DEFAULT_FREE_PLAY_BPM);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordingActive, setRecordingActive] = useState(false);

  const metronomeRef = useRef<Metronome | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const startMsRef = useRef<number>(0);
  const startIsoRef = useRef<string>("");
  const endedRef = useRef(false);

  useEffect(() => {
    if (!loadedSettings) void loadSettings();
  }, [loadedSettings, loadSettings]);

  // RAF loop for the count-up display.
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const now = Date.now();
      setElapsedSec(Math.max(0, (now - startMsRef.current) / 1000));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  const startSession = useCallback(async () => {
    unlockSharedAudioContext();
    const parsedBpm = parseInt(bpmInput, 10);
    const safeBpm =
      Number.isFinite(parsedBpm) && parsedBpm >= MIN_BPM && parsedBpm <= MAX_BPM
        ? parsedBpm
        : DEFAULT_FREE_PLAY_BPM;
    setActiveBpm(safeBpm);

    clearLatestRecording();

    if (metronomeOn) {
      const m = new Metronome();
      m.setVolume(settings.metronomeVolume);
      m.setAccentsEnabled(settings.accentsEnabled);
      try {
        await m.start(safeBpm, "all");
        metronomeRef.current = m;
      } catch {
        m.dispose();
      }
    }

    if (settings.recordingEnabled) {
      const rec = new SessionRecorder();
      try {
        await rec.start();
        recorderRef.current = rec;
        setRecordingActive(true);
      } catch {
        recorderRef.current = null;
        setRecordingActive(false);
      }
    }

    const startMs = Date.now();
    startMsRef.current = startMs;
    startIsoRef.current = new Date(startMs).toISOString();
    endedRef.current = false;
    setElapsedSec(0);
    setPhase("running");
  }, [
    bpmInput,
    metronomeOn,
    settings.metronomeVolume,
    settings.accentsEnabled,
    settings.recordingEnabled,
    clearLatestRecording,
  ]);

  const endSession = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;

    const elapsed = startMsRef.current
      ? (Date.now() - startMsRef.current) / 1000
      : 0;

    const m = metronomeRef.current;
    if (m) {
      m.stop();
      m.dispose();
      metronomeRef.current = null;
    }

    if (startIsoRef.current && elapsed > 0) {
      const rec: SessionRecord = {
        id: genSessionRecordId(),
        itemId: FREE_PLAY_ITEM_ID,
        itemKind: "exercise",
        itemTitle: FREE_PLAY_ITEM_TITLE,
        startedAt: startIsoRef.current,
        endedAt: new Date().toISOString(),
        durationSec: Math.max(0, Math.round(elapsed)),
        endedReason: "complete",
        plannedMinutes: 0,
        startWorkingBpm: activeBpm,
        endWorkingBpm: activeBpm,
        startTroubleBpms: [],
        endTroubleBpms: [],
        promotions: [],
      };
      void appendSessionRecord(rec).catch(() => {
        // best-effort
      });
    }

    const rec = recorderRef.current;
    if (rec) {
      try {
        const result = await rec.stop();
        const blobUrl = URL.createObjectURL(result.blob);
        setLatestRecording({
          songId: FREE_PLAY_ITEM_ID,
          blob: result.blob,
          blobUrl,
          durationSec: result.durationSec,
          durationMinutes: 0,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // swallow
      }
    }
    recorderRef.current = null;
    setRecordingActive(false);
    setPhase("ended");
  }, [activeBpm, appendSessionRecord, setLatestRecording]);

  const handleMetronomeToggleInSession = useCallback(async () => {
    if (metronomeOn) {
      const m = metronomeRef.current;
      if (m) {
        m.stop();
        m.dispose();
        metronomeRef.current = null;
      }
      setMetronomeOn(false);
      return;
    }
    unlockSharedAudioContext();
    const m = new Metronome();
    m.setVolume(settings.metronomeVolume);
    m.setAccentsEnabled(settings.accentsEnabled);
    try {
      await m.start(activeBpm, "all");
      metronomeRef.current = m;
      setMetronomeOn(true);
    } catch {
      m.dispose();
    }
  }, [
    metronomeOn,
    activeBpm,
    settings.metronomeVolume,
    settings.accentsEnabled,
  ]);

  const handleBpmChangeInSession = useCallback(
    (next: number) => {
      const safe = Math.max(MIN_BPM, Math.min(MAX_BPM, next));
      setActiveBpm(safe);
      setBpmInput(String(safe));
      metronomeRef.current?.setBpm(safe);
    },
    [],
  );

  // Esc / End keyboard shortcut while running.
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        void endSession();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, endSession]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  if (!loadedSettings) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Loading...
      </main>
    );
  }

  if (phase === "setup") {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-neutral-400 transition hover:text-neutral-100"
        >
          ← Back
        </button>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Free play / Transcribe
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          A count-up timer for unstructured practice — transcribing, fiddling, or
          just playing. Time is recorded in your stats but isn&apos;t tied to any
          specific song or exercise.
        </p>

        <div className="mt-8 space-y-5 rounded-lg border border-bg-border bg-bg-elevated p-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={metronomeOn}
              onChange={(e) => setMetronomeOn(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-amber-500"
            />
            <div>
              <div className="text-sm font-medium text-neutral-200">
                Play metronome
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                Off by default — most transcribing happens without a click. You
                can toggle it on/off mid-session.
              </div>
            </div>
          </label>

          {metronomeOn && (
            <label className="block">
              <div className="mb-1 text-sm font-medium text-neutral-200">
                BPM
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_BPM}
                max={MAX_BPM}
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
                className="w-32 rounded-lg border border-[#232a33] bg-[#14181d] px-3 py-2 text-neutral-100 outline-none focus:border-amber-500"
              />
            </label>
          )}

          <button
            onClick={() => void startSession()}
            className="w-full rounded-lg bg-accent px-6 py-4 text-lg font-semibold text-black transition hover:bg-accent-strong"
          >
            Start free play
          </button>
        </div>
      </main>
    );
  }

  if (phase === "ended") {
    return (
      <main className="mx-auto max-w-xl px-6 py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Session ended</h1>
        <div className="mt-6 font-mono text-5xl font-bold tabular-nums text-accent">
          {formatPracticeTime(Math.round(elapsedSec))}
        </div>
        <p className="mt-2 text-sm text-neutral-400">recorded in your stats</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-bg-border px-5 py-2.5 font-semibold text-neutral-200 transition hover:bg-bg-elevated"
          >
            Back to home
          </button>
          <button
            onClick={() => router.push("/stats")}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-black transition hover:bg-accent-strong"
          >
            See stats
          </button>
        </div>
      </main>
    );
  }

  // phase === "running"
  return (
    <main className="relative flex h-screen flex-col overflow-hidden px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <RecordingIndicator active={recordingActive} />
        </div>
        <div className="text-center">
          <div className="text-sm text-neutral-400">Free play</div>
          <div className="text-xs text-neutral-600">
            {metronomeOn ? `Metronome ${activeBpm} BPM` : "No metronome"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleMetronomeToggleInSession()}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              metronomeOn
                ? "border-accent bg-accent text-black hover:bg-accent-strong"
                : "border-bg-border text-neutral-200 hover:border-accent"
            }`}
          >
            {metronomeOn ? "Click on" : "Click off"}
          </button>
          <button
            onClick={() => void endSession()}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:border-red-900 hover:text-red-300"
          >
            End
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 pt-2">
        {metronomeOn && (
          <MetronomeIndicator metronome={metronomeRef.current} />
        )}
        <BlockCountUp seconds={elapsedSec} />
        {metronomeOn && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBpmChangeInSession(activeBpm - 5)}
              className="rounded-lg border border-bg-border px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-bg-elevated"
            >
              −5
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_BPM}
              max={MAX_BPM}
              value={bpmInput}
              onChange={(e) => {
                setBpmInput(e.target.value);
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= MIN_BPM && n <= MAX_BPM) {
                  setActiveBpm(n);
                  metronomeRef.current?.setBpm(n);
                }
              }}
              className="w-24 rounded-lg border border-[#232a33] bg-[#14181d] px-3 py-1.5 text-center font-mono text-base text-neutral-100 outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={() => handleBpmChangeInSession(activeBpm + 5)}
              className="rounded-lg border border-bg-border px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-bg-elevated"
            >
              +5
            </button>
          </div>
        )}
        <p className="text-center text-xs text-neutral-500">
          Press <span className="font-mono">Esc</span> when you&apos;re done — your
          time goes to stats.
        </p>
      </div>
    </main>
  );
}
