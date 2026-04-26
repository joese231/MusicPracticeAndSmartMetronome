"use client";
export function PreviousBlockButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-bg-border px-4 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
    >
      Previous block
    </button>
  );
}
