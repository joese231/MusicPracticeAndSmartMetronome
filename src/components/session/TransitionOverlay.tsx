"use client";
export function TransitionOverlay({
  nextLabel,
  nextTempo,
}: {
  nextLabel: string;
  nextTempo: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Up next</div>
        <div className="mt-2 text-4xl font-semibold text-neutral-100">{nextLabel}</div>
        <div className="mt-2 font-mono text-5xl font-bold text-accent tabular-nums">
          {nextTempo}
          <span className="ml-2 text-xl text-neutral-400">BPM</span>
        </div>
      </div>
    </div>
  );
}
