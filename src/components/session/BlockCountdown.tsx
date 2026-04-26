"use client";
import { formatCountdown } from "@/lib/format";

export function BlockCountdown({ seconds }: { seconds: number }) {
  return (
    <div className="font-mono text-5xl font-bold tabular-nums text-neutral-100 md:text-6xl">
      {formatCountdown(seconds)}
    </div>
  );
}
