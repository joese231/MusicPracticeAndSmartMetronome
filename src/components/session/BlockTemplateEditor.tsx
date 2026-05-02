"use client";
import {
  EXERCISE_BLOCK_LABELS,
  EXERCISE_BLOCK_TEMPO_HINT,
  SONG_BLOCK_LABELS,
  SONG_BLOCK_TEMPO_HINT,
  type ExerciseBlockKind,
  type ExerciseBlockTemplate,
  type SongBlockKind,
  type SongBlockTemplate,
} from "@/types/song";

type Kind = SongBlockKind | ExerciseBlockKind;

type EditorProps<T extends { kind: Kind; enabled: boolean; weight: number }> = {
  template: T[];
  onChange: (next: T[]) => void;
  /** Total session minutes for the live preview (e.g. 10 for songs, sessionMinutes for exercises). */
  previewMinutes: number;
  /** Reset the template to the user's default. Hidden when null. */
  onReset?: () => void;
  /** Domain — selects label/hint maps. */
  variant: "song" | "exercise";
  /** When > 0 and a troubleSpot row is enabled, the preview displays the
   * row's allocated time as split across this many spots. */
  troubleSpotCount?: number;
};

const labelFor = (variant: "song" | "exercise", kind: Kind): string => {
  if (variant === "song") return SONG_BLOCK_LABELS[kind as SongBlockKind];
  return EXERCISE_BLOCK_LABELS[kind as ExerciseBlockKind];
};

const hintFor = (variant: "song" | "exercise", kind: Kind): string => {
  if (variant === "song") return SONG_BLOCK_TEMPO_HINT[kind as SongBlockKind];
  return EXERCISE_BLOCK_TEMPO_HINT[kind as ExerciseBlockKind];
};

const fmtSecs = (secs: number): string => {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

export function BlockTemplateEditor<
  T extends { kind: Kind; enabled: boolean; weight: number },
>({
  template,
  onChange,
  previewMinutes,
  onReset,
  variant,
  troubleSpotCount = 0,
}: EditorProps<T>) {
  const update = (idx: number, patch: Partial<T>) => {
    const next = template.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange(next);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= template.length) return;
    const next = template.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  // Live preview: filter active rows, compute proportional seconds.
  const totalSec = Math.max(0, Math.round(previewMinutes * 60));
  const active = template.filter(
    (e) =>
      e.enabled &&
      e.weight > 0 &&
      (variant !== "song" || e.kind !== "troubleSpot" || troubleSpotCount > 0),
  );
  const totalWeight = active.reduce((a, e) => a + e.weight, 0);
  const previewSecs = totalWeight > 0
    ? active.map((e) => Math.floor((e.weight / totalWeight) * totalSec))
    : [];
  const previewItems = active.map((e, i) => {
    const secs = previewSecs[i] ?? 0;
    if (variant === "song" && e.kind === "troubleSpot" && troubleSpotCount > 0) {
      const per = Math.floor(secs / troubleSpotCount);
      return `${labelFor(variant, e.kind)} ${fmtSecs(per)} × ${troubleSpotCount}`;
    }
    return `${labelFor(variant, e.kind)} ${fmtSecs(secs)}`;
  });

  const noActive = active.length === 0;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {template.map((entry, idx) => {
          const enabled = entry.enabled;
          return (
            <li
              key={`${entry.kind}-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-bg-border bg-bg/40 p-3"
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  update(idx, { enabled: e.target.checked } as Partial<T>)
                }
                className="h-4 w-4 cursor-pointer accent-amber-500"
                aria-label={`Include ${labelFor(variant, entry.kind)}`}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${
                    enabled ? "text-neutral-100" : "text-neutral-500"
                  }`}
                >
                  {labelFor(variant, entry.kind)}
                </div>
                <div className="text-xs text-neutral-500">
                  {hintFor(variant, entry.kind)}
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>Weight</span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  step={1}
                  value={entry.weight}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    update(idx, {
                      weight: Number.isFinite(n) && n > 0 ? n : 1,
                    } as Partial<T>);
                  }}
                  disabled={!enabled}
                  className="w-16 rounded border border-bg-border bg-bg px-2 py-1 text-right text-sm text-neutral-100 outline-none focus:border-accent disabled:opacity-50"
                />
              </label>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move ${labelFor(variant, entry.kind)} up`}
                  className="rounded border border-bg-border px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-bg-elevated disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === template.length - 1}
                  aria-label={`Move ${labelFor(variant, entry.kind)} down`}
                  className="rounded border border-bg-border px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-bg-elevated disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded border border-bg-border bg-bg/30 px-3 py-2 text-xs">
        <div className="text-neutral-500">
          Preview at {previewMinutes} min:
        </div>
        {noActive ? (
          <div className="mt-0.5 text-red-300">
            No blocks enabled. Enable at least one before saving.
          </div>
        ) : (
          <div className="mt-0.5 text-neutral-300">
            {previewItems.join(" · ")}
          </div>
        )}
      </div>

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
  );
}

/** Validate that at least one row is enabled with positive weight. */
export const isTemplateValid = (
  template: { enabled: boolean; weight: number }[],
): boolean =>
  template.some((e) => e.enabled && e.weight > 0);

export type { SongBlockTemplate, ExerciseBlockTemplate };
