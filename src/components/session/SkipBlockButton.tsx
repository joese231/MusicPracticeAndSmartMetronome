"use client";
export function SkipBlockButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-bg-border px-4 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated"
    >
      Skip block
    </button>
  );
}
