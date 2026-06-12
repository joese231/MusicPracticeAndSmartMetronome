"use client";
import React, { useState } from "react";
import {
  allocateBlockDurations,
  validateBlockDurationPlan,
} from "@/lib/session/duration";
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

const durationChip = (
  entry: SmartBlockRecipe,
  variant: "song" | "exercise",
): string => {
  const additive = isAdditiveTroubleEntry(entry, variant);
  if (entry.duration.kind === "fixed") {
    return `${additive ? "+" : ""}${fmtSecs(entry.duration.seconds)}${
      additive ? " each" : " fixed"
    }`;
  }
  return `${additive ? "+" : ""}${entry.duration.percent}%${
    additive ? " each" : " remaining"
  }`;
};

const tempoRuleLabel = (rule: TempoRule): string => {
  const source =
    rule.source === "working"
      ? "Working"
      : rule.source === "target"
        ? "Target"
        : rule.source === "overspeed"
          ? "Overspeed"
          : rule.source === "original"
            ? "Original"
            : rule.source === "trouble"
              ? "Trouble"
              : `${rule.bpm} BPM`;
  const adjustment = "adjustment" in rule ? rule.adjustment : undefined;
  if (!adjustment || rule.source === "fixed") return source;
  if (adjustment.kind === "percent") return `${source} x ${adjustment.value}%`;
  if (adjustment.kind === "bpmOffset") {
    return `${source} ${adjustment.value >= 0 ? "+" : ""}${adjustment.value} BPM`;
  }
  return `${source} ${adjustment.value >= 0 ? "+" : ""}${adjustment.value} step${
    Math.abs(adjustment.value) === 1 ? "" : "s"
  }`;
};

const progressionLabel = (
  progression: ProgressionRule,
  entry: SmartBlockRecipe,
  variant: "song" | "exercise",
): string => {
  if (
    progression.kind === "trouble" &&
    variant === "song" &&
    entry.role === "troubleSpot"
  ) {
    return "Promote trouble";
  }
  if (progression.kind === "working") return "Promote working";
  return "No progression";
};

const isAdditiveTroubleEntry = (
  entry: SmartBlockRecipe,
  variant: "song" | "exercise",
): boolean => variant === "song" && entry.role === "troubleSpot";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const active = activeTemplateEntries(template, variant, troubleSpotCount);
  const allocationEntries = allocationTemplateEntries(
    template,
    variant,
    troubleSpotCount,
  );
  const additiveEntries = additiveTemplateEntries(
    template,
    variant,
    troubleSpotCount,
  );
  const validation = validateTemplateForSession(
    template,
    previewMinutes,
    variant,
    troubleSpotCount,
  );
  const allocation = allocateBlockDurations(
    totalSec,
    allocationEntries.map((entry) => ({ id: entry.id, duration: entry.duration })),
  );
  const additiveRecipeEntries =
    variant === "song"
      ? template.filter(
          (entry) =>
            entry.enabled &&
            entry.role === "troubleSpot" &&
            durationIsPositive(entry.duration),
        )
      : [];
  const baseAllocatedSec = allocation.ok
    ? allocationEntries.reduce(
        (sum, entry) => sum + (allocation.durations.get(entry.id) ?? 0),
        0,
      )
    : 0;
  const additivePerSpotSec = additiveRecipeEntries.reduce(
    (sum, entry) => sum + additiveEntryDurationSec(entry, totalSec),
    0,
  );
  const additiveActualSec = additivePerSpotSec * troubleSpotCount;
  const hasPercentBlocks = allocationEntries.some(
    (entry) => entry.duration.kind === "percent",
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-bg-border bg-bg/40 p-3 text-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-neutral-100">Block recipe</div>
            <div className="mt-1 max-w-2xl text-neutral-400">
              Fixed-time blocks keep their exact duration. Percentage blocks divide
              whatever time remains after fixed blocks are subtracted.
            </div>
          </div>
          <div className="flex flex-wrap justify-start gap-2 md:justify-end">
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                validation.ok
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "bg-red-500/15 text-red-200"
              }`}
            >
              Base total: {fmtSecs(baseAllocatedSec)} / {fmtSecs(totalSec)}
            </span>
            {additiveRecipeEntries.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200">
                Trouble: +{fmtSecs(additivePerSpotSec)} per spot
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 text-neutral-400">
          {active.length === 0 ? (
            <span className="text-red-300">
              No blocks enabled. Enable at least one before saving.
            </span>
          ) : !validation.ok ? (
            <span className="text-red-300">{validation.message}</span>
          ) : (
            <>
              {hasPercentBlocks && allocation.ok && (
                <span className="mr-2">
                  {fmtSecs(allocation.remainingSec)} remains for percentage blocks.
                </span>
              )}
              {additiveRecipeEntries.length > 0 && (
                <span>
                  Trouble spot time is added outside the base session
                  {troubleSpotCount > 0
                    ? ` (${fmtSecs(additiveActualSec)} for ${troubleSpotCount} spot${
                        troubleSpotCount === 1 ? "" : "s"
                      }).`
                    : "."}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <ul className="space-y-3">
        {template.map((entry, idx) => {
          const additive = isAdditiveTroubleEntry(entry, variant);
          const isExpanded = expandedId === entry.id;
          return (
          <li
            key={entry.id}
            className={`space-y-3 rounded-lg border p-3 ${
              additive
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-bg-border bg-bg/40"
            } ${entry.enabled ? "" : "opacity-70"}`}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(e) => update(idx, { enabled: e.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-amber-500"
                  aria-label={`Include ${entry.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-sm font-black leading-none text-neutral-600"
                      aria-hidden
                    >
                      ::
                    </span>
                    <div className="min-w-0 text-sm font-semibold text-neutral-100">
                      {entry.name}
                    </div>
                  </div>
                  {entry.purpose && (
                    <div className="mt-1 line-clamp-2 text-xs text-neutral-400">
                      {entry.purpose}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        additive
                          ? "bg-emerald-500/20 text-emerald-100"
                          : "bg-amber-500/15 text-amber-100"
                      }`}
                    >
                      {durationChip(entry, variant)}
                    </span>
                    <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-neutral-300">
                      {tempoRuleLabel(entry.tempoRule)}
                    </span>
                    <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-neutral-300">
                      {progressionLabel(entry.progression, entry, variant)}
                    </span>
                    <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-neutral-300">
                      {entry.metronomeEnabled ? "Metronome on" : "Metronome off"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-2">
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
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  aria-expanded={isExpanded}
                  className="rounded border border-bg-border px-2 py-1 text-xs text-neutral-300 hover:bg-bg-elevated"
                >
                  {isExpanded ? "Collapse" : "Edit"}
                </button>
              </div>
            </div>
            {additive && (
              <div className="rounded border border-emerald-500/30 bg-bg/40 px-3 py-2 text-xs text-emerald-100">
                Additive block: this runs once per saved trouble spot and does not
                count against the base session duration.
              </div>
            )}

            {isExpanded && (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[minmax(12rem,0.8fr)_minmax(16rem,1.2fr)]">
                  <label className="min-w-0 text-xs text-neutral-400">
                    Name
                    <input
                      value={entry.name}
                      onChange={(e) => update(idx, { name: e.target.value })}
                      className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm font-semibold text-neutral-100 outline-none focus:border-accent"
                    />
                  </label>
                  <label className="min-w-0 text-xs text-neutral-400">
                    Purpose
                    <input
                      value={entry.purpose}
                      onChange={(e) => update(idx, { purpose: e.target.value })}
                      className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[12rem] flex-[1_1_12rem]">
                    <DurationEditor
                      value={entry.duration}
                      onChange={(duration) => update(idx, { duration })}
                      disabled={!entry.enabled}
                      maxFixedMinutes={Math.max(
                        0.25,
                        roundMinutes(
                          (entry.role === "troubleSpot" && variant === "song"
                            ? totalSec
                            : totalSec -
                              template.reduce((sum, other, otherIdx) => {
                                if (otherIdx === idx || !other.enabled) return sum;
                                if (
                                  variant === "song" &&
                                  other.role === "troubleSpot"
                                ) {
                                  return sum;
                                }
                                if (other.duration.kind !== "fixed") return sum;
                                return sum + Math.max(0, other.duration.seconds);
                              }, 0)) / 60,
                        ),
                      )}
                    />
                  </div>
                  <div className="min-w-[15rem] flex-[1_1_15rem]">
                    <TempoRuleEditor
                      value={entry.tempoRule}
                      onChange={(tempoRule) => update(idx, { tempoRule })}
                      disabled={!entry.enabled}
                    />
                  </div>
                  <label className="min-w-[10rem] flex-[1_1_10rem] text-xs text-neutral-400">
                    Progression
                    <select
                      value={
                        entry.progression.kind === "trouble" &&
                        !(variant === "song" && entry.role === "troubleSpot")
                          ? "none"
                          : entry.progression.kind
                      }
                      onChange={(e) =>
                        update(idx, {
                          progression: {
                            kind: e.target.value as ProgressionRule["kind"],
                          },
                        })
                      }
                      disabled={!entry.enabled}
                      className="mt-1 w-full rounded border border-bg-border bg-bg px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
                    >
                      <option value="none">None</option>
                      <option value="working">Promote working</option>
                      {variant === "song" && entry.role === "troubleSpot" && (
                        <option value="trouble">Promote trouble</option>
                      )}
                    </select>
                  </label>
                  <label className="flex min-w-[8rem] flex-[0_1_8rem] items-center gap-2 pt-6 text-xs text-neutral-300">
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
              </div>
            )}
          </li>
          );
        })}
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

      {additiveEntries.length > 0 && allocation.ok && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          This song currently has {troubleSpotCount} trouble spot
          {troubleSpotCount === 1 ? "" : "s"}, adding{" "}
          {fmtSecs(additiveActualSec)} outside the {fmtSecs(totalSec)} base session.
        </div>
      )}
    </div>
  );
}

function DurationEditor({
  value,
  onChange,
  disabled,
  maxFixedMinutes,
}: {
  value: BlockDurationRule;
  onChange: (value: BlockDurationRule) => void;
  disabled: boolean;
  maxFixedMinutes: number;
}) {
  const amount =
    value.kind === "fixed" ? roundMinutes(value.seconds / 60) : value.percent;
  const max = value.kind === "fixed" ? maxFixedMinutes : 100;
  return (
    <label className="text-xs text-neutral-400">
      Duration
      <div className="mt-1 flex gap-1">
        <select
          value={value.kind}
          onChange={(e) =>
            onChange(
              e.target.value === "fixed"
                ? {
                    kind: "fixed",
                    seconds: Math.round(
                      Math.min(maxFixedMinutes, Math.max(0.25, Number(amount))) *
                      60,
                    ),
                  }
                : {
                    kind: "percent",
                    percent: Math.max(1, Math.min(100, Math.round(amount))),
                  },
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
          min={value.kind === "fixed" ? 0.25 : 1}
          max={max}
          step={value.kind === "fixed" ? 0.25 : 1}
          value={amount}
          onChange={(e) => {
            const raw =
              value.kind === "fixed"
                ? parseFloat(e.target.value)
                : parseInt(e.target.value, 10);
            const n = Math.max(
              value.kind === "fixed" ? 0.25 : 1,
              Math.min(max, Number.isFinite(raw) ? raw : 1),
            );
            onChange(
              value.kind === "fixed"
                ? { kind: "fixed", seconds: Math.round(n * 60) }
                : { kind: "percent", percent: n },
            );
          }}
          disabled={disabled}
          className="w-20 rounded border border-bg-border bg-bg px-2 py-1.5 text-right text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
        />
      </div>
      <div className="mt-0.5 text-[10px] text-neutral-500">
        {value.kind === "fixed" ? "minutes" : "% of remaining"}
      </div>
    </label>
  );
}

function roundMinutes(value: number): number {
  return Math.round(value * 100) / 100;
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

function activeTemplateEntries(
  template: SmartBlockRecipe[],
  variant: "song" | "exercise",
  troubleSpotCount = 0,
): SmartBlockRecipe[] {
  return template.filter(
    (e) =>
      e.enabled &&
      durationIsPositive(e.duration) &&
      (variant !== "song" || e.role !== "troubleSpot" || troubleSpotCount > 0),
  );
}

function allocationTemplateEntries(
  template: SmartBlockRecipe[],
  variant: "song" | "exercise",
  troubleSpotCount = 0,
): SmartBlockRecipe[] {
  return activeTemplateEntries(template, variant, troubleSpotCount).filter(
    (e) => !(variant === "song" && e.role === "troubleSpot"),
  );
}

function additiveTemplateEntries(
  template: SmartBlockRecipe[],
  variant: "song" | "exercise",
  troubleSpotCount = 0,
): SmartBlockRecipe[] {
  if (variant !== "song" || troubleSpotCount <= 0) return [];
  return activeTemplateEntries(template, variant, troubleSpotCount).filter(
    (e) => e.role === "troubleSpot",
  );
}

function additiveEntryDurationSec(
  entry: SmartBlockRecipe,
  baseTotalSec: number,
): number {
  if (entry.duration.kind === "fixed") {
    return Math.max(0, Math.round(entry.duration.seconds));
  }
  return Math.max(0, Math.round((entry.duration.percent / 100) * baseTotalSec));
}

export function validateTemplateForSession(
  template: SmartBlockRecipe[],
  previewMinutes: number,
  variant: "song" | "exercise" = "song",
  troubleSpotCount = 0,
): { ok: true } | { ok: false; message: string } {
  const invalidTroubleProgression = template.some(
    (entry) =>
      entry.progression.kind === "trouble" &&
      !(variant === "song" && entry.role === "troubleSpot"),
  );
  if (invalidTroubleProgression) {
    return {
      ok: false,
      message: "Trouble progression is only available on song Trouble Spot blocks.",
    };
  }

  const active = allocationTemplateEntries(template, variant, troubleSpotCount);
  if (active.length === 0) {
    return { ok: false, message: "Enable at least one block in the block sequence." };
  }
  const totalSec = Math.max(0, Math.round(previewMinutes * 60));
  const validation = validateBlockDurationPlan(
    totalSec,
    active.map((entry) => ({ id: entry.id, duration: entry.duration })),
  );
  if (validation.ok) return { ok: true };
  if (validation.reason === "fixed-exceeds-total") {
    return {
      ok: false,
      message: "Fixed block time cannot exceed the selected session length.",
    };
  }
  if (validation.reason === "fixed-underfills-total") {
    return {
      ok: false,
      message:
        "Fixed-only blocks must add up to the selected session length, or add a percentage block to use the remaining time.",
    };
  }
  if (validation.reason === "percent-exceeds-100") {
    return {
      ok: false,
      message: "Percentage blocks cannot be higher than 100%.",
    };
  }
  return {
    ok: false,
    message: "Percentage blocks must have a positive value.",
  };
}

export const isTemplateValid = (template: SmartBlockRecipe[]): boolean =>
  validateTemplateForSession(template, 1).ok;

export type { SongBlockTemplate, ExerciseBlockTemplate };
