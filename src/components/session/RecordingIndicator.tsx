"use client";
export function RecordingIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-red-400">
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
      <span className="uppercase tracking-wider">REC</span>
    </div>
  );
}
