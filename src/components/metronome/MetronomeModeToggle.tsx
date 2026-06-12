"use client";
import React from "react";
import type { MetronomeMode } from "@/lib/metronome/scheduler";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const METRONOME_MODE_OPTIONS: Array<{ value: MetronomeMode; label: string }> = [
  { value: "all", label: "All beats" },
  { value: "backbeat", label: "Backbeat 2 & 4" },
];

export function MetronomeModeToggle({
  mode,
  onChange,
}: {
  mode: MetronomeMode;
  onChange: (m: MetronomeMode) => void;
}) {
  return (
    <SegmentedControl
      value={mode}
      options={METRONOME_MODE_OPTIONS}
      onChange={onChange}
      ariaLabel="Metronome beat mode"
      className="bg-bg-elevated"
    />
  );
}
