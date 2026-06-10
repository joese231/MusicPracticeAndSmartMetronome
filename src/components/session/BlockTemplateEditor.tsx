"use client";
import { allocateBlockDurations } from "@/lib/session/duration";
import type {
  BlockDurationRule,
  ExerciseBlockTemplate,
  ProgressionRule,
  SmartBlockRecipe,
  SongBlockTemplate,
  TempoRule,
} from "@/types/song";

type EditorProps = {
  template: SmartBlockRecipe[];
  onChange: (next: SmartBlockRecipe[]) => void;
  previewMinutes: number;
  onReset?: () => void;
  variant: "song" | "exercise";
  troubleSpotCount?: number;
};

const fmtSecs = (secs: number): string => {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultCustomBlock = (): SmartBlockRecipe => ({
  id: newId(),
  role: "custom",
  name: "Custom Block",
  purpose: "Describe the focus for this block.",
  instructions: ["Practice with the chosen focus for this block."],
  enabled: true,
  duration: { kind: "percent", percent: 100 },
  tempoRule: { source: "working" },
  metronomeEnabled: true,
  progression: { kind: "none" },
});

export function BlockTemplateEditor({
  template,
  onChange,
  previewMinutes,
  onReset,
  variant,
  troubleSpotCount = 0,
}: EditorProps) {
  const update = (idx: number, patch: Partial<SmartBlockRecipe>) => {
    onChange(template.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= template.length) return;
    const next = template.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => {
    onChange(template.filter((_, i) => i !== idx));
  };
  const add = () => onChange([...template, defaultCustomBlock()]);

  const totalSec = Math.max(0, Math.round(previewMinutes * 60));
  const active = template.filter(
    (e) =>
      e.enabled &&
      durationIsPositive(e.duration) &&
      (variant !== "song" || e.role !== "troubleSpot" || troubleSpotCount > 0),
  );
  const allocation = allocateBlockDurations(
    totalSec,
    active.map((entry) => ({ id: entry.id, duration: entry.duration })),
  );
  const previewItems =
    allocation.ok
      ? active.map((e) => {
          const secs = allocation.durations.get(e.id) ?? 0;
          if (variant === "song" && e.role === "troubleSpot" && troubleSpotCount > 0) {
            const per = Math.floor(secs / troubleSpotCount);
            return `${e.name} ${fmtSecs(per)} x ${troubleSpotCount}`;
          }
          return `${e.name} ${fmtSecs(secs)}`;
        })
      : [];

  return (
    <div className="space-y-3">
      <div className="rounded border border-bg-border bg-bg/30 px-3 py-2 text-xs text-neutral-400">
        Fixed-time blocks keep their exact duration. Percentage blocks divide
        whatever time remains after fixed blocks are subtracted.
      </div>

      <ul className="space-y-3">
        {template.map((entry, idx) => (
          <li
            key={entry.id}
            className="space-y-3 rounded-lg border border-bg-border bg-bg/40 p-3"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={entry.enabled}
                onChange={(e) => update(idx, { enabled: e.target.checked })}
                className="mt-2 h-4 w-4 cursor-pointer accent-amber-500"
                aria-label={`Include ${entry.name}`}
              />
              <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
                <label className="text-xs text-neutral-400">
                  Name
                  <input
                    value={entry.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                    className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent"
                  />
                </label>
                <label className="text-xs text-neutral-400">
                  Purpose
                  <input
                    value={entry.purpose}
                    onChange={(e) => update(idx, { purpose: e.target.value })}
                    className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="rounded border border-bg-border px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-bg-elevated disabled:opacity-30"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === template.length - 1}
                  className="rounded border border-bg-border px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-bg-elevated disabled:opacity-30"
                >
                  Down
                </button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <DurationEditor
                value={entry.duration}
                onChange={(duration) => update(idx, { duration })}
                disabled={!entry.enabled}
              />
              <TempoRuleEditor
                value={entry.tempoRule}
                onChange={(tempoRule) => update(idx, { tempoRule })}
                disabled={!entry.enabled}
              />
              <label className="text-xs text-neutral-400">
                Progression
                <select
                  value={entry.progression.kind}
                  onChange={(e) =>
                    update(idx, {
                      progression: { kind: e.target.value as ProgressionRule["kind"] },
                    })
                  }
                  disabled={!entry.enabled}
                  className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
                >
                  <option value="none">None</option>
                  <option value="working">Promote working</option>
                  {entry.role === "troubleSpot" && (
                    <option value="trouble">Promote trouble</option>
                  )}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={entry.metronomeEnabled}
                  onChange={(e) =>
                    update(idx, { metronomeEnabled: e.target.checked })
                  }
                  disabled={!entry.enabled}
                  className="h-4 w-4 accent-amber-500 disabled:opacity-50"
                />
                Metronome
              </label>
            </div>

            <label className="block text-xs text-neutral-400">
              Instructions
              <textarea
                value={entry.instructions.join("\n")}
                onChange={(e) =>
                  update(idx, {
                    instructions: e.target.value
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
                rows={2}
                className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent"
              />
            </label>

            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-xs text-neutral-500 underline hover:text-red-300"
            >
              Remove block
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-bg-border px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-bg-elevated"
        >
          Add block
        </button>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-neutral-400 underline hover:text-neutral-200"
          >
            Reset to default template
          </button>
        )}
      </div>

      <div className="rounded border border-bg-border bg-bg/30 px-3 py-2 text-xs">
        <div className="text-neutral-500">Preview at {previewMinutes} min:</div>
        {active.length === 0 ? (
          <div className="mt-0.5 text-red-300">
            No blocks enabled. Enable at least one before saving.
          </div>
        ) : allocation.ok ? (
          <div className="mt-0.5 text-neutral-300">
            {allocation.fixedSec > 0 && (
              <span className="mr-1 text-neutral-500">
                {fmtSecs(allocation.remainingSec)} remains for percentage blocks.
              </span>
            )}
            {previewItems.join(" · ")}
          </div>
        ) : (
          <div className="mt-0.5 text-red-300">
            Fixed block time exceeds the selected session length.
          </div>
        )}
      </div>
    </div>
  );
}

function DurationEditor({
  value,
  onChange,
  disabled,
}: {
  value: BlockDurationRule;
  onChange: (value: BlockDurationRule) => void;
  disabled: boolean;
}) {
  const amount =
    value.kind === "fixed" ? Math.round(value.seconds / 60) : value.percent;
  return (
    <label className="text-xs text-neutral-400">
      Duration
      <div className="mt-1 flex gap-1">
        <select
          value={value.kind}
          onChange={(e) =>
            onChange(
              e.target.value === "fixed"
                ? { kind: "fixed", seconds: Math.max(1, Math.round(amount)) * 60 }
                : { kind: "percent", percent: Math.max(1, Math.round(amount)) },
            )
          }
          disabled={disabled}
          className="w-24 rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
        >
          <option value="percent">Percent</option>
          <option value="fixed">Fixed</option>
        </select>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => {
            const n = Math.max(1, parseInt(e.target.value, 10) || 1);
            onChange(
              value.kind === "fixed"
                ? { kind: "fixed", seconds: n * 60 }
                : { kind: "percent", percent: n },
            );
          }}
          disabled={disabled}
          className="min-w-0 flex-1 rounded border border-bg-border bg-bg px-2 py-1.5 text-right text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
        />
      </div>
      <div className="mt-0.5 text-[10px] text-neutral-500">
        {value.kind === "fixed" ? "minutes" : "% of remaining"}
      </div>
    </label>
  );
}

function TempoRuleEditor({
  value,
  onChange,
  disabled,
}: {
  value: TempoRule;
  onChange: (value: TempoRule) => void;
  disabled: boolean;
}) {
  const source = value.source;
  const adjustment = "adjustment" in value ? value.adjustment : undefined;
  const setSource = (nextSource: TempoRule["source"]) => {
    if (nextSource === "fixed") onChange({ source: "fixed", bpm: 100 });
    else if (nextSource === "original") {
      onChange({ source: "original", fallback: { source: "working" } });
    } else if (nextSource === "trouble") {
      onChange({ source: "trouble", fallback: { source: "working" } });
    } else {
      onChange({ source: nextSource });
    }
  };
  return (
    <label className="text-xs text-neutral-400">
      Tempo
      <div className="mt-1 grid grid-cols-2 gap-1">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as TempoRule["source"])}
          disabled={disabled}
          className="rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
        >
          <option value="working">Working</option>
          <option value="target">Target</option>
          <option value="overspeed">Overspeed</option>
          <option value="original">Original</option>
          <option value="trouble">Trouble</option>
          <option value="fixed">Fixed</option>
        </select>
        {source === "fixed" ? (
          <input
            type="number"
            min={20}
            value={value.bpm}
            onChange={(e) =>
              onChange({ source: "fixed", bpm: parseInt(e.target.value, 10) || 20 })
            }
            disabled={disabled}
            className="rounded border border-bg-border bg-bg px-2 py-1.5 text-right text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
          />
        ) : (
          <select
            value={adjustment?.kind ?? "none"}
            onChange={(e) => {
              const kind = e.target.value;
              const patch =
                kind === "none"
                  ? undefined
                  : kind === "percent"
                    ? { kind: "percent" as const, value: 80 }
                    : kind === "bpmOffset"
                      ? { kind: "bpmOffset" as const, value: 0 }
                      : { kind: "steps" as const, value: 1 };
              onChange(withAdjustment(value, patch));
            }}
            disabled={disabled}
            className="rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="none">As-is</option>
            <option value="percent">Percent</option>
            <option value="bpmOffset">+/- BPM</option>
            <option value="steps">Steps</option>
          </select>
        )}
      </div>
      {source !== "fixed" && adjustment && (
        <input
          type="number"
          value={adjustment.value}
          onChange={(e) =>
            onChange(
              withAdjustment(value, {
                ...adjustment,
                value: parseFloat(e.target.value) || 0,
              }),
            )
          }
          disabled={disabled}
          className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-right text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
        />
      )}
    </label>
  );
}

function withAdjustment(
  rule: TempoRule,
  adjustment: Exclude<TempoRule, { source: "fixed" }>["adjustment"],
): TempoRule {
  if (rule.source === "fixed") return rule;
  if (rule.source === "original" || rule.source === "trouble") {
    return { ...rule, adjustment };
  }
  return { ...rule, adjustment };
}

function durationIsPositive(duration: BlockDurationRule): boolean {
  return duration.kind === "fixed" ? duration.seconds > 0 : duration.percent > 0;
}

export const isTemplateValid = (template: SmartBlockRecipe[]): boolean =>
  template.some((e) => e.enabled && durationIsPositive(e.duration));

export type { SongBlockTemplate, ExerciseBlockTemplate };
