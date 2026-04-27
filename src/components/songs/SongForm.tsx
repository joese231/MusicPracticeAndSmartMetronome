"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_INCLUDE_WARMUP,
  DEFAULT_STEP_PERCENT,
  MAX_TROUBLE_SPOTS,
} from "@/types/song";
import type { PracticeMode, TroubleSpot } from "@/types/song";
import { useSettingsStore } from "@/lib/store/useSettingsStore";

export type SongFormValues = {
  title: string;
  link: string | null;
  workingBpm: number;
  troubleSpots: TroubleSpot[];
  originalBpm: number | null;
  stepPercent: number;
  practiceMode: PracticeMode;
  includeWarmupBlock: boolean;
};

type Props = {
  initial?: Partial<SongFormValues>;
  submitLabel: string;
  onSubmit: (values: SongFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export function SongForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [workingBpm, setWorkingBpm] = useState<string>(
    initial?.workingBpm != null ? String(initial.workingBpm) : "",
  );

  const initialSpotInputs: string[] = (initial?.troubleSpots ?? []).map((ts) =>
    ts.bpm != null ? String(ts.bpm) : "",
  );
  const [troubleCount, setTroubleCount] = useState<number>(initialSpotInputs.length);
  const [troubleBpms, setTroubleBpms] = useState<string[]>(initialSpotInputs);

  const [originalBpm, setOriginalBpm] = useState<string>(
    initial?.originalBpm != null ? String(initial.originalBpm) : "",
  );
  const [stepPercent, setStepPercent] = useState<string>(
    String(initial?.stepPercent ?? DEFAULT_STEP_PERCENT),
  );

  // Practice mode + warm-up block toggle.
  // For new songs (no `initial.practiceMode`), seed from the global setting
  // once it's loaded; for edits, take whatever the song already has. The
  // user can override it freely with the buttons below either way.
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const settingsDefaultMode = useSettingsStore(
    (s) => s.settings.defaultPracticeMode,
  );
  const settingsLoad = useSettingsStore((s) => s.load);
  const isEditing = initial?.practiceMode !== undefined;
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(
    initial?.practiceMode ?? "smart",
  );
  const [practiceModeTouched, setPracticeModeTouched] = useState(false);
  const [includeWarmupBlock, setIncludeWarmupBlock] = useState<boolean>(
    initial?.includeWarmupBlock ?? DEFAULT_INCLUDE_WARMUP,
  );
  useEffect(() => {
    if (!settingsLoaded) void settingsLoad();
  }, [settingsLoaded, settingsLoad]);
  // Once settings finish loading, adopt the global default for new songs
  // unless the user has already picked a mode in this session.
  useEffect(() => {
    if (isEditing || practiceModeTouched) return;
    if (!settingsLoaded) return;
    setPracticeMode(settingsDefaultMode);
  }, [isEditing, practiceModeTouched, settingsLoaded, settingsDefaultMode]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parseOptInt = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const setCount = (next: number) => {
    const clamped = Math.max(0, Math.min(MAX_TROUBLE_SPOTS, next));
    setTroubleCount(clamped);
    setTroubleBpms((prev) => {
      const copy = prev.slice(0, clamped);
      while (copy.length < clamped) copy.push("");
      return copy;
    });
  };

  const setSpotBpm = (index: number, value: string) => {
    setTroubleBpms((prev) => {
      const copy = prev.slice();
      copy[index] = value;
      return copy;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const w = parseInt(workingBpm, 10);
    if (!Number.isFinite(w) || w < 30 || w > 400) {
      setError("Working BPM must be between 30 and 400.");
      return;
    }

    const spots: TroubleSpot[] = [];
    for (let i = 0; i < troubleCount; i++) {
      const t = parseOptInt(troubleBpms[i] ?? "");
      if (t != null && (t < 30 || t > 400)) {
        setError(`Trouble Spot ${i + 1} BPM must be between 30 and 400.`);
        return;
      }
      spots.push({ bpm: t });
    }

    const o = parseOptInt(originalBpm);
    if (o != null && (o < 30 || o > 400)) {
      setError("Original BPM must be between 30 and 400.");
      return;
    }
    const sp = parseFloat(stepPercent);
    if (!Number.isFinite(sp) || sp < 0.5 || sp > 10) {
      setError("Step % must be between 0.5 and 10.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        link: link.trim() ? link.trim() : null,
        workingBpm: w,
        troubleSpots: spots,
        originalBpm: o,
        stepPercent: sp,
        practiceMode,
        includeWarmupBlock,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Title" hint="The name of the tune.">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field-input"
          placeholder="Blackberry Blossom"
          required
        />
      </Field>

      <Field label="Link (optional)" hint="A YouTube, Spotify, or tab URL — opens in a new tab from the song page.">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="field-input"
          placeholder="https://..."
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Starting working BPM" hint="The BPM at which you can already play the full tune cleanly and relaxed.">
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={400}
            value={workingBpm}
            onChange={(e) => setWorkingBpm(e.target.value)}
            className="field-input"
            required
          />
        </Field>

        <Field label="Original song BPM (optional)" hint="Tempo of the original recording. Display-only — does not affect session math.">
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={400}
            value={originalBpm}
            onChange={(e) => setOriginalBpm(e.target.value)}
            className="field-input"
          />
        </Field>

        <Field label="Tempo step %" hint="How much each 'I earned it' tap bumps the tempo. 2.5 is a good default.">
          <input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={10}
            step={0.1}
            value={stepPercent}
            onChange={(e) => setStepPercent(e.target.value)}
            className="field-input"
            required
          />
        </Field>
      </div>

      <section className="space-y-4 rounded-lg border border-bg-border bg-bg/40 p-5">
        <div>
          <div className="text-sm font-semibold text-neutral-100">
            Practice mode
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            Smart runs the three-tempo ladder with trouble-spot blocks. Simple plays a steady BPM at your working tempo for the whole session — like a regular metronome with a stop timer.
          </div>
          <div className="mt-3 inline-flex overflow-hidden rounded-lg border border-bg-border bg-bg">
            {(["smart", "simple"] as const).map((m) => {
              const active = practiceMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setPracticeMode(m);
                    setPracticeModeTouched(true);
                  }}
                  className={`px-4 py-1.5 text-sm font-semibold capitalize transition ${
                    active
                      ? "bg-accent text-black"
                      : "text-neutral-300 hover:bg-bg-elevated"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={includeWarmupBlock}
            onChange={(e) => setIncludeWarmupBlock(e.target.checked)}
            className="mt-1 h-4 w-4 cursor-pointer accent-amber-500"
          />
          <div>
            <div className="text-sm font-medium text-neutral-200">
              Include slow Conscious Practice warm-up block
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              When on, the session starts with the unbounded slow warm-up — you advance with N when ready. Turn off to jump straight into the body.
            </div>
          </div>
        </label>
      </section>

      <section className="rounded-lg border-2 border-accent/40 bg-bg-elevated p-5">
        {practiceMode === "simple" && (
          <div className="mb-3 rounded border border-bg-border bg-bg/40 px-3 py-2 text-xs text-neutral-400">
            Trouble spots are saved but not used in Simple mode. Switch to Smart to drill them.
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-accent">
              Trouble spots ({troubleCount} of {MAX_TROUBLE_SPOTS})
            </div>
            <div className="mt-1 text-xs text-neutral-400">
              How many hard passages does this tune have? Each spot gets its own practice block and promotes independently. Use the + / − buttons to set the count.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCount(troubleCount - 1)}
              disabled={troubleCount === 0}
              className="h-10 w-10 rounded-lg border border-bg-border bg-bg text-2xl leading-none text-neutral-100 transition hover:border-accent hover:bg-bg-elevated disabled:opacity-40"
              aria-label="Decrease trouble spots"
            >
              −
            </button>
            <div className="w-10 text-center font-mono text-2xl tabular-nums text-neutral-100">
              {troubleCount}
            </div>
            <button
              type="button"
              onClick={() => setCount(troubleCount + 1)}
              disabled={troubleCount >= MAX_TROUBLE_SPOTS}
              className="h-10 w-10 rounded-lg border border-bg-border bg-bg text-2xl leading-none text-neutral-100 transition hover:border-accent hover:bg-bg-elevated disabled:opacity-40"
              aria-label="Increase trouble spots"
            >
              +
            </button>
          </div>
        </div>

        {troubleCount > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from({ length: troubleCount }).map((_, i) => (
              <Field
                key={i}
                label={`Trouble Spot ${i + 1} BPM (optional)`}
                hint="BPM at which this spot is cleanly playable in isolation. Leave blank to fall back to slow-reference tempo."
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={400}
                  value={troubleBpms[i] ?? ""}
                  onChange={(e) => setSpotBpm(i, e.target.value)}
                  className="field-input"
                />
              </Field>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-black transition hover:bg-accent-strong disabled:opacity-60"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2.5 text-neutral-300 transition hover:bg-bg-elevated"
          >
            Cancel
          </button>
        )}
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #232a33;
          background: #14181d;
          padding: 0.625rem 0.875rem;
          color: #f5f5f5;
          outline: none;
        }
        .field-input:focus {
          border-color: #f59e0b;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-neutral-200">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </label>
  );
}
