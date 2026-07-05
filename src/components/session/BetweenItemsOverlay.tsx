"use client";

/**
 * Inter-item countdown overlay shown between consecutive song or exercise
 * sessions when `Settings.interSongPauseSec > 0`. The session page owns the
 * timer state (so it can pause/resume coherently with the session timer);
 * this component renders the UI given the derived state.
 */
export function BetweenItemsOverlay({
  nextItemTitle,
  remainingSec,
  paused,
  onSkip,
  onCancel,
  onPauseToggle,
  onRepeatLastBlock,
}: {
  nextItemTitle: string;
  remainingSec: number;
  paused: boolean;
  onSkip: () => void;
  onCancel: () => void;
  onPauseToggle: () => void;
  onRepeatLastBlock?: () => void;
}) {
  return (
    <main className="flex h-screen flex-col items-center justify-center px-6 py-10">
      <div className="text-xs uppercase text-neutral-500">
        Up next
      </div>
      <div className="mt-4 max-w-2xl text-center text-4xl font-bold text-neutral-100">
        {nextItemTitle}
      </div>
      <div className="mt-10 font-mono text-8xl font-bold tabular-nums text-accent">
        {remainingSec}
      </div>
      <div className="mt-2 text-sm text-neutral-500">
        {paused ? "Paused" : "seconds until next session"}
      </div>
      <div className="mt-10 flex w-full max-w-2xl flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-xl bg-accent px-8 py-4 text-lg font-bold text-black shadow-lg transition hover:bg-accent-strong sm:w-auto"
        >
          Start now
          <span className="ml-3 text-sm font-normal opacity-70">(Space)</span>
        </button>
        <button
          type="button"
          onClick={onPauseToggle}
          className={`w-full rounded-xl border px-6 py-4 text-sm font-semibold transition sm:w-auto ${
            paused
              ? "border-accent bg-accent text-black hover:bg-accent-strong"
              : "border-bg-border text-neutral-200 hover:border-accent hover:text-neutral-100"
          }`}
        >
          {paused ? "Resume" : "Pause"}
          <span className="ml-3 text-xs font-normal opacity-70">(P)</span>
        </button>
        {onRepeatLastBlock && (
          <button
            type="button"
            onClick={onRepeatLastBlock}
            className="w-full rounded-xl border border-bg-border px-6 py-4 text-sm text-neutral-300 transition hover:border-accent/60 hover:text-neutral-100 sm:w-auto"
          >
            ← Repeat last block
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-xl border border-bg-border px-6 py-4 text-sm text-neutral-300 transition hover:border-red-900 hover:text-red-300 sm:w-auto"
        >
          End session
          <span className="ml-3 text-xs font-normal opacity-70">(Esc)</span>
        </button>
      </div>
    </main>
  );
}
