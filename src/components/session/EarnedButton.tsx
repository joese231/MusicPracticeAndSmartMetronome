"use client";
export function EarnedButton({
  onClick,
  disabled,
  hint,
}: {
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full rounded-2xl bg-accent px-8 py-8 text-3xl font-bold text-black shadow-lg transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none md:text-4xl"
      >
        I earned it
      </button>
      {hint && (
        <div className="mt-1 text-xs text-neutral-500">{hint}</div>
      )}
    </div>
  );
}
