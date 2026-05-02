"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  cloneExerciseTemplate,
  DEFAULT_EXERCISE_BLOCK_TEMPLATE,
  DEFAULT_INCLUDE_WARMUP,
  DEFAULT_STEP_PERCENT,
} from "@/types/song";
import type { ExerciseBlockTemplate, PracticeMode } from "@/types/song";
import {
  DEFAULT_EXERCISE_MINUTES,
  MAX_EXERCISE_MINUTES,
  MIN_EXERCISE_MINUTES,
} from "@/lib/session/exerciseBlocks";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import {
  BlockTemplateEditor,
  isTemplateValid,
} from "@/components/session/BlockTemplateEditor";

export type ExerciseFormValues = {
  name: string;
  link: string | null;
  notes: string | null;
  workingBpm: number;
  stepPercent: number;
  sessionMinutes: number;
  openEnded: boolean;
  metronomeEnabled: boolean;
  practiceMode: PracticeMode;
  includeWarmupBlock: boolean;
  blockTemplate: ExerciseBlockTemplate;
};

type Props = {
  initial?: Partial<ExerciseFormValues>;
  submitLabel: string;
  onSubmit: (values: ExerciseFormValues) => void | Promise<void>;
  onCancel?: () => void;
  secondarySubmit?: {
    label: string;
    onSubmit: (values: ExerciseFormValues) => void | Promise<void>;
  };
};

export function ExerciseForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  secondarySubmit,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [workingBpm, setWorkingBpm] = useState<string>(
    initial?.workingBpm != null ? String(initial.workingBpm) : "",
  );
  const [stepPercent, setStepPercent] = useState<string>(
    String(initial?.stepPercent ?? DEFAULT_STEP_PERCENT),
  );
  const [sessionMinutes, setSessionMinutes] = useState<string>(
    String(initial?.sessionMinutes ?? DEFAULT_EXERCISE_MINUTES),
  );
  const [openEnded, setOpenEnded] = useState<boolean>(initial?.openEnded ?? false);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(
    initial?.metronomeEnabled ?? true,
  );

  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const settingsDefaultMode = useSettingsStore(
    (s) => s.settings.defaultPracticeMode,
  );
  const settingsDefaultTemplate = useSettingsStore(
    (s) => s.settings.defaultExerciseBlockTemplate,
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
  const [blockTemplate, setBlockTemplate] = useState<ExerciseBlockTemplate>(
    initial?.blockTemplate
      ? cloneExerciseTemplate(initial.blockTemplate)
      : cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE),
  );
  const [blockTemplateTouched, setBlockTemplateTouched] = useState(false);
  useEffect(() => {
    if (!settingsLoaded) void settingsLoad();
  }, [settingsLoaded, settingsLoad]);
  useEffect(() => {
    if (isEditing || practiceModeTouched) return;
    if (!settingsLoaded) return;
    setPracticeMode(settingsDefaultMode);
  }, [isEditing, practiceModeTouched, settingsLoaded, settingsDefaultMode]);
  useEffect(() => {
    if (isEditing || blockTemplateTouched) return;
    if (!settingsLoaded) return;
    if (settingsDefaultTemplate && settingsDefaultTemplate.length > 0) {
      setBlockTemplate(cloneExerciseTemplate(settingsDefaultTemplate));
    }
  }, [isEditing, blockTemplateTouched, settingsLoaded, settingsDefaultTemplate]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): ExerciseFormValues | null => {
    if (!name.trim()) {
      setError("Name is required.");
      return null;
    }
    const w = parseInt(workingBpm, 10);
    if (!Number.isFinite(w) || w < 30 || w > 400) {
      setError("Working BPM must be between 30 and 400.");
      return null;
    }
    const sp = parseFloat(stepPercent);
    if (!Number.isFinite(sp) || sp < 0.5 || sp > 10) {
      setError("Step % must be between 0.5 and 10.");
      return null;
    }
    const sm = parseInt(sessionMinutes, 10);
    // Session length is irrelevant for open-ended exercises but we still
    // persist a sane value so toggling the flag back on restores a length.
    if (
      !openEnded &&
      (!Number.isFinite(sm) ||
        sm < MIN_EXERCISE_MINUTES ||
        sm > MAX_EXERCISE_MINUTES)
    ) {
      setError(
        `Session length must be between ${MIN_EXERCISE_MINUTES} and ${MAX_EXERCISE_MINUTES} minutes.`,
      );
      return null;
    }
    const safeMinutes = Number.isFinite(sm)
      ? Math.max(MIN_EXERCISE_MINUTES, Math.min(MAX_EXERCISE_MINUTES, sm))
      : DEFAULT_EXERCISE_MINUTES;
    if (
      !openEnded &&
      practiceMode === "smart" &&
      !isTemplateValid(blockTemplate)
    ) {
      setError("Enable at least one block in the block sequence.");
      return null;
    }
    return {
      name: name.trim(),
      link: link.trim() ? link.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      workingBpm: w,
      stepPercent: sp,
      sessionMinutes: safeMinutes,
      openEnded,
      metronomeEnabled,
      practiceMode,
      includeWarmupBlock,
      blockTemplate,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const values = validate();
    if (!values) return;
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  };

  const handleSecondary = async () => {
    if (!secondarySubmit) return;
    setError(null);
    const values = validate();
    if (!values) return;
    setBusy(true);
    try {
      await secondarySubmit.onSubmit(values);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Name" hint="What's this exercise called? E.g. 'Crosspicking — Trischka pattern 3'.">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input"
          placeholder="Crosspicking — pattern 3"
          required
        />
      </Field>

      <Field label="Link (optional)" hint="A YouTube or tab URL for the exercise — opens in a new tab from the detail page.">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="field-input"
          placeholder="https://..."
        />
      </Field>

      <Field label="Notes (optional)" hint='Short reminders. E.g. "rest stroke", "alternate picking strict".'>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
          rows={3}
          placeholder="Reminders to yourself"
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Starting working BPM" hint="The BPM at which you can already play this exercise cleanly and relaxed.">
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

        <Field label="Tempo step %" hint="How much each '+' / 'I earned it' tap bumps the tempo. 2.5 is a good default.">
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

        {!openEnded && (
          <Field
            label="Session length (minutes)"
            hint={`Total metronome-on time per session (${MIN_EXERCISE_MINUTES}–${MAX_EXERCISE_MINUTES}). Burst stays 1.5 min and Cool Down stays 30 sec — extra time goes into Build.`}
          >
            <input
              type="number"
              inputMode="numeric"
              min={MIN_EXERCISE_MINUTES}
              max={MAX_EXERCISE_MINUTES}
              step={1}
              value={sessionMinutes}
              onChange={(e) => setSessionMinutes(e.target.value)}
              className="field-input"
              required
            />
          </Field>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-bg-border bg-bg/40 p-4">
        <Checkbox
          checked={openEnded}
          onChange={setOpenEnded}
          label="Open-ended (no time blocks — just a count-up timer)"
          hint="When on, the session is a single count-up timer at your working BPM — no warm-up, no Build/Burst/Cool Down. Useful for transcribing or unstructured practice. Press Esc when you're done."
        />
        <Checkbox
          checked={!metronomeEnabled}
          onChange={(v) => setMetronomeEnabled(!v)}
          label="Disable metronome for this exercise"
          hint="When on, the session runs without the click. Saved on this exercise so transcribing-style drills don't need to re-toggle every session."
        />
      </div>

      <div
        className={`space-y-4 rounded-lg border border-bg-border bg-bg/40 p-4 transition ${
          openEnded ? "pointer-events-none opacity-50" : ""
        }`}
        aria-disabled={openEnded}
      >
        <div>
          <div className="text-sm font-semibold text-neutral-100">
            Practice mode
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            Smart runs Build → Burst → Cool Down with promotion. Simple plays a steady BPM at your working tempo for the whole session — like a regular metronome with a stop timer.
            {openEnded && " Ignored while Open-ended is on."}
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

        <Checkbox
          checked={includeWarmupBlock}
          onChange={setIncludeWarmupBlock}
          label="Include slow Conscious Practice warm-up block"
          hint="When on, the session starts with the unbounded slow warm-up — you advance with N when ready. Turn off to jump straight into the body."
        />

        {practiceMode === "smart" && (
          <div className="space-y-2 border-t border-bg-border pt-4">
            <div>
              <div className="text-sm font-semibold text-neutral-100">
                Block sequence
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Toggle blocks on or off, reorder them, and adjust their relative size. Time is split proportionally to fill the chosen session length.
              </div>
            </div>
            <BlockTemplateEditor
              variant="exercise"
              template={blockTemplate}
              onChange={(t) => {
                setBlockTemplate(t);
                setBlockTemplateTouched(true);
              }}
              previewMinutes={(() => {
                const sm = parseInt(sessionMinutes, 10);
                return Number.isFinite(sm)
                  ? Math.max(MIN_EXERCISE_MINUTES, Math.min(MAX_EXERCISE_MINUTES, sm))
                  : DEFAULT_EXERCISE_MINUTES;
              })()}
              onReset={
                settingsDefaultTemplate && settingsDefaultTemplate.length > 0
                  ? () => {
                      setBlockTemplate(
                        cloneExerciseTemplate(settingsDefaultTemplate),
                      );
                      setBlockTemplateTouched(true);
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

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
        {secondarySubmit && (
          <button
            type="button"
            onClick={handleSecondary}
            disabled={busy}
            className="rounded-lg border border-bg-border px-4 py-2.5 font-semibold text-neutral-200 transition hover:bg-bg-elevated disabled:opacity-60"
          >
            {secondarySubmit.label}
          </button>
        )}
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

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 cursor-pointer accent-amber-500"
      />
      <div>
        <div className="text-sm font-medium text-neutral-200">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-neutral-500">{hint}</div>}
      </div>
    </label>
  );
}
