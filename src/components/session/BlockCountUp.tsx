"use client";
import { formatDuration } from "@/lib/format";

export function BlockCountUp({ seconds }: { seconds: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
        Elapsed
      </div>
      <div className="font-mono text-5xl font-bold tabular-nums text-neutral-100 md:text-6xl">
        {formatDuration(seconds)}
      </div>
    </div>
  );
}
