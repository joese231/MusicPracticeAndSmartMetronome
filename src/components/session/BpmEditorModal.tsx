"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  helperText: string;
  initialBpm: number;
  onSave: (bpm: number) => void;
  onCancel: () => void;
  /** Optional "Reset to default" action. When provided, renders a button
   * that calls this and closes the modal — used by the warm-up editor to
   * clear the saved per-song warmupBpm and fall back to the ⅓ rule. */
  onReset?: () => void;
  resetLabel?: string;
};

const MIN_BPM = 30;
const MAX_BPM = 400;

/**
 * Inline BPM editor shown mid-session so the player can correct a wrong
 * value without tearing down the session. The caller wires which underlying
 * field (workingBpm or a trouble spot) this edits based on the current
 * block; this component is just the input dialog.
 */
export function BpmEditorModal({
  open,
  title,
  helperText,
  initialBpm,
  onSave,
  onCancel,
  onReset,
  resetLabel = "Reset to default",
}: Props) {
  const [value, setValue] = useState<string>(String(initialBpm));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(String(initialBpm));
    // Defer focus to after the modal paints so the input is actually in the
    // DOM when we ask for focus.
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [open, initialBpm]);

  if (!open) return null;

  const submit = () => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, parsed));
    if (clamped === initialBpm) {
      onCancel();
      return;
    }
    onSave(clamped);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-[min(90vw,24rem)] rounded-2xl border border-bg-border bg-bg-elevated p-6 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            submit();
          }
        }}
      >
        <div className="text-sm font-semibold uppercase tracking-wider text-accent">
          {title}
        </div>
        <div className="mt-2 text-xs text-neutral-400">{helperText}</div>
        <div className="mt-5">
          <label className="block text-xs uppercase tracking-wider text-neutral-500">
            BPM
          </label>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-2 w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-2xl font-bold tabular-nums text-neutral-100 focus:border-accent focus:outline-none"
          />
          <div className="mt-1 text-[11px] text-neutral-500">
            Range: {MIN_BPM}–{MAX_BPM}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="mr-auto rounded-lg border border-bg-border px-4 py-2 text-sm text-neutral-300 hover:bg-bg"
            >
              {resetLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-bg-border px-4 py-2 text-sm text-neutral-300 hover:bg-bg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-black hover:bg-accent-strong"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
