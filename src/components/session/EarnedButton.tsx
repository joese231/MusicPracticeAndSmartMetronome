"use client";
export function EarnedButton({
  onClick,
  disabled,
  hint,
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-2xl bg-accent px-8 font-bold text-black shadow-lg transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none ${compact ? "py-3 text-lg" : "py-8 text-3xl md:text-4xl"}`}
      >
        I earned it
      </button>
      {hint && (
        <div className="mt-1 text-xs text-neutral-500">{hint}</div>
      )}
    </div>
  );
}
