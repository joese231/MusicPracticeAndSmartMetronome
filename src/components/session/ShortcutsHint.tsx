"use client";
export function ShortcutsHint() {
  return (
    <div className="text-center text-xs text-neutral-500 md:text-sm">
      <Kbd>Space</Kbd> Next block
      <span className="mx-3 text-neutral-700">·</span>
      <Kbd>+</Kbd> Earned
      <span className="mx-3 text-neutral-700">·</span>
      <Kbd>P</Kbd> Pause
      <span className="mx-3 text-neutral-700">·</span>
      <Kbd>R</Kbd> Reset block
      <span className="mx-3 text-neutral-700">·</span>
      <Kbd>Esc</Kbd> End session
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-bg-border bg-bg-elevated px-1.5 py-0.5 font-mono text-[0.7rem] text-neutral-300">
      {children}
    </kbd>
  );
}
