"use client";
export function BlockHeader({
  label,
  tempoBpm,
  blockIndex,
  totalBlocks,
}: {
  label: string;
  tempoBpm: number;
  blockIndex: number;
  totalBlocks: number;
}) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        Block {blockIndex + 1} / {totalBlocks}
      </div>
      <h2 className="mt-1 text-2xl font-semibold text-neutral-100 md:text-3xl">{label}</h2>
      <div className="mt-2 flex items-baseline justify-center gap-2">
        <span className="font-mono text-7xl font-bold leading-none text-accent tabular-nums md:text-8xl">
          {tempoBpm}
        </span>
        <span className="text-xl text-neutral-400">BPM</span>
      </div>
    </div>
  );
}
