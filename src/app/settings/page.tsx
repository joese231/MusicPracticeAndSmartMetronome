"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { Metronome } from "@/lib/metronome/scheduler";

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const update = useSettingsStore((s) => s.update);

  const metronomeRef = useRef<Metronome | null>(null);

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
            label="Pause between songs"
            hint="After a song's session finishes, wait this long before the next song in the list starts. Press Space during the countdown to skip, or Esc to exit. 0 disables the pause."
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
