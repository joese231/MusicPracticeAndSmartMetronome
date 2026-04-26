"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { useSessionStore } from "@/lib/store/useSessionStore";
import { getRepository } from "@/lib/db/localRepository";
import { Metronome } from "@/lib/metronome/scheduler";

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const update = useSettingsStore((s) => s.update);

  const loadSongs = useSongsStore((s) => s.load);
  const loadExercises = useExercisesStore((s) => s.load);
  const loadHistory = useSessionHistoryStore((s) => s.load);
  const clearLatestRecording = useSessionStore((s) => s.clearLatestRecording);

  const metronomeRef = useRef<Metronome | null>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmFactory, setConfirmFactory] = useState(false);
  const [busyAction, setBusyAction] = useState<null | "reset" | "factory">(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
    };
  }, []);

  const getMetronome = (): Metronome => {
    if (!metronomeRef.current) metronomeRef.current = new Metronome();
    return metronomeRef.current;
  };

  const previewClick = () => {
    const m = getMetronome();
    m.setVolume(settings.metronomeVolume);
    m.setAccentsEnabled(settings.accentsEnabled);
    m.playPreviewClick();
  };

  const handleResetStats = async () => {
    setBusyAction("reset");
    setActionMessage(null);
    try {
      await getRepository().resetAllStatistics();
      await Promise.all([loadSongs(), loadExercises(), loadHistory()]);
      setActionMessage("All practice times zeroed and session history erased.");
      setConfirmReset(false);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? `Reset failed: ${err.message}` : "Reset failed",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleFactoryReset = async () => {
    setBusyAction("factory");
    setActionMessage(null);
    try {
      await getRepository().factoryReset();
      clearLatestRecording();
      await Promise.all([loadSongs(), loadExercises(), loadHistory()]);
      setActionMessage(
        "All songs, exercises, and session history deleted. Settings preserved.",
      );
      setConfirmFactory(false);
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? `Factory reset failed: ${err.message}`
          : "Factory reset failed",
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Settings</h1>

      {!loaded ? (
        <p className="mt-8 text-neutral-500">Loading...</p>
      ) : (
        <div className="mt-8 space-y-6">
          <Row
            label="Record practice sessions"
            hint="When off, no audio is captured during a session and the microphone permission is not requested."
          >
            <Toggle
              checked={settings.recordingEnabled}
              onChange={(v) => update({ recordingEnabled: v })}
            />
          </Row>

          <Row
            label="Use accented clicks"
            hint="When off, every metronome click sounds identical — useful if you want to hear a pure pulse."
          >
            <Toggle
              checked={settings.accentsEnabled}
              onChange={(v) => update({ accentsEnabled: v })}
            />
          </Row>

          <Row
            label="Auto-advance between blocks"
            hint="When off (default), each block ends with a Space-to-continue pause so you can finish your current pass of the tune. When on, the session flows straight into the next block after a brief chime — the legacy behavior."
          >
            <Toggle
              checked={settings.autoAdvanceBlocks}
              onChange={(v) => update({ autoAdvanceBlocks: v })}
            />
          </Row>

          <Row
            label="Pause between items"
            hint="After a song or exercise session finishes, wait this long before the next item in the list starts. Press Space during the countdown to skip, or Esc to exit. 0 disables the pause."
          >
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={settings.interSongPauseSec}
                onChange={(e) =>
                  update({ interSongPauseSec: parseInt(e.target.value, 10) })
                }
                className="w-48"
              />
              <span className="w-12 text-right text-sm tabular-nums text-neutral-400">
                {settings.interSongPauseSec === 0
                  ? "Off"
                  : `${settings.interSongPauseSec} s`}
              </span>
            </div>
          </Row>

          <Row
            label="Metronome volume"
            hint="Tap Preview to hear the current volume and accent setting."
          >
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.metronomeVolume}
                onChange={(e) => update({ metronomeVolume: parseFloat(e.target.value) })}
                className="w-48"
              />
              <span className="w-10 text-right text-sm tabular-nums text-neutral-400">
                {Math.round(settings.metronomeVolume * 100)}%
              </span>
              <button
                type="button"
                onClick={previewClick}
                className="rounded-lg border border-bg-border px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-bg-elevated"
              >
                Preview
              </button>
            </div>
          </Row>

          <section className="mt-10 space-y-4 rounded-lg border border-red-900/50 bg-red-950/10 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-300">
                Danger zone
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Destructive actions. There is no undo.
              </p>
            </div>

            {actionMessage && (
              <div className="rounded border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
                {actionMessage}
              </div>
            )}

            <DangerRow
              label="Reset all statistics"
              hint="Zero out every song's and exercise's total practice time and erase all session history. Your songs and exercises themselves stay — including their working BPM and trouble spots."
            >
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionMessage(null);
                    setConfirmReset(true);
                    setConfirmFactory(false);
                  }}
                  className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950/40"
                  disabled={busyAction !== null}
                >
                  Reset stats…
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResetStats()}
                    disabled={busyAction !== null}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {busyAction === "reset" ? "Resetting…" : "Yes, reset everything"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    disabled={busyAction !== null}
                    className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 hover:bg-bg-elevated"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </DangerRow>

            <DangerRow
              label="Delete all songs and exercises"
              hint="Factory reset — wipes every song, every exercise, and every session record. Settings (volume, accents, recording) are preserved. Use this when handing the app to a new user."
            >
              {!confirmFactory ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionMessage(null);
                    setConfirmFactory(true);
                    setConfirmReset(false);
                  }}
                  className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950/40"
                  disabled={busyAction !== null}
                >
                  Factory reset…
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleFactoryReset()}
                    disabled={busyAction !== null}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {busyAction === "factory"
                      ? "Wiping…"
                      : "Yes, delete everything"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmFactory(false)}
                    disabled={busyAction !== null}
                    className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 hover:bg-bg-elevated"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </DangerRow>
          </section>
        </div>
      )}
    </main>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-neutral-100">{label}</div>
          {hint && <div className="mt-1 text-sm text-neutral-500">{hint}</div>}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function DangerRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-red-900/40 bg-bg/30 p-4">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-neutral-100">{label}</div>
        {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition ${
        checked ? "bg-accent" : "bg-bg-border"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
