"use client";
import type { MetronomeMode } from "@/lib/metronome/scheduler";

export function MetronomeModeToggle({
  mode,
  onChange,
}: {
  mode: MetronomeMode;
  onChange: (m: MetronomeMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-bg-border bg-bg-elevated p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-md px-3 py-1.5 transition ${
          mode === "all" ? "bg-accent text-black font-semibold" : "text-neutral-300 hover:text-neutral-100"
        }`}
      >
        All beats
      </button>
      <button
        type="button"
        onClick={() => onChange("backbeat")}
        className={`rounded-md px-3 py-1.5 transition ${
          mode === "backbeat" ? "bg-accent text-black font-semibold" : "text-neutral-300 hover:text-neutral-100"
        }`}
      >
        Backbeat 2 &amp; 4
      </button>
    </div>
  );
}
