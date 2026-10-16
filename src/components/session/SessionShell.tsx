"use client";

import React, { type ReactNode } from "react";
import type { BlockDef } from "@/types/block";
import type { Metronome, MetronomeMode } from "@/lib/metronome/scheduler";
import { BlockHeader } from "@/components/session/BlockHeader";
import { BlockCountdown } from "@/components/session/BlockCountdown";
import { BlockCountUp } from "@/components/session/BlockCountUp";
import { BlockInstructions } from "@/components/session/BlockInstructions";
import { EarnedButton } from "@/components/session/EarnedButton";
import { SkipBlockButton } from "@/components/session/SkipBlockButton";
import { PreviousBlockButton } from "@/components/session/PreviousBlockButton";
import { ShortcutsHint } from "@/components/session/ShortcutsHint";
import { RecordingIndicator } from "@/components/session/RecordingIndicator";
import { MetronomeIndicator } from "@/components/metronome/MetronomeIndicator";
import { MetronomeModeToggle } from "@/components/metronome/MetronomeModeToggle";

type Toast = { id: number; text: string };

type SessionShellProps = {
  title: string;
  finishing?: boolean;
  subtitle: string;
  currentBlock?: BlockDef;
  nextBlock?: BlockDef;
  currentBlockLabel?: string;
  nextBlockLabel?: string;
  tempoBpm: number;
  nextTempoBpm?: number;
  blockIndex: number;
  totalBlocks: number;
  awaiting: boolean;
  paused: boolean;
  isUnbounded: boolean;
  elapsedSec: number;
  timeLeftSec: number;
  recordingActive: boolean;
  metronomeMode: MetronomeMode;
  metronome: Metronome | null;
  showMetronomeControls?: boolean;
  showMetronomeIndicator?: boolean;
  canResetBlock?: boolean;
  canEditBpm?: boolean;
  canPause?: boolean;
  canPrevious?: boolean;
  showEarnedButton?: boolean;
  earnedHint?: string;
  unboundedActionLabel?: string;
  unboundedActionShortcut?: string;
  notesPanel?: ReactNode;
  itemControls?: ReactNode;
  onRepeatSession?: () => void;
  beforePrimaryControls?: ReactNode;
  children?: ReactNode;
  toasts?: Toast[];
  onMetronomeModeChange: (mode: MetronomeMode) => void;
  onResetBlock: () => void;
  onEditBpm: () => void;
  onPauseToggle: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onEarned: () => void;
  onAdvance: () => void;
  onRepeatBlock: () => void;
  onUnboundedAction?: () => void;
};

export function SessionShell({
  title,
  finishing = false,
  subtitle,
  currentBlock,
  nextBlock,
  currentBlockLabel,
  nextBlockLabel,
  tempoBpm,
  nextTempoBpm,
  blockIndex,
  totalBlocks,
  awaiting,
  paused,
  isUnbounded,
  elapsedSec,
  timeLeftSec,
  recordingActive,
  metronomeMode,
  metronome,
  showMetronomeControls = true,
  showMetronomeIndicator = true,
  canResetBlock = true,
  canEditBpm = true,
  canPause = true,
  canPrevious = true,
  showEarnedButton = false,
  earnedHint,
  unboundedActionLabel,
  unboundedActionShortcut = "(Space)",
  notesPanel,
  itemControls,
  onRepeatSession,
  beforePrimaryControls,
  children,
  toasts = [],
  onMetronomeModeChange,
  onResetBlock,
  onEditBpm,
  onPauseToggle,
  onPrevious,
  onSkip,
  onEnd,
  onEarned,
  onAdvance,
  onRepeatBlock,
  onUnboundedAction,
}: SessionShellProps) {
  if (finishing) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-neutral-400">{title}</p>
          <p role="status" className="mt-3 text-2xl font-semibold text-accent">Finishing session…</p>
        </div>
      </main>
    );
  }
  const displayCurrentLabel = currentBlockLabel ?? currentBlock?.label ?? "";
  const displayNextLabel = nextBlockLabel ?? nextBlock?.label ?? "";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-[3rem] items-center gap-3">
          <RecordingIndicator active={recordingActive} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:flex-none">
          <div className="truncate text-sm text-neutral-400">{title}</div>
          <div className="text-xs text-neutral-600">{subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {itemControls}
          {showMetronomeControls && (
            <MetronomeModeToggle
              mode={metronomeMode}
              onChange={onMetronomeModeChange}
            />
          )}
          <button
            type="button"
            onClick={onResetBlock}
            disabled={!canResetBlock}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset block
          </button>
          <button
            type="button"
            onClick={onEditBpm}
            disabled={!canEditBpm}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            Edit BPM
          </button>
          <button
            type="button"
            onClick={onPauseToggle}
            disabled={!canPause && !paused}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              paused
                ? "border-accent bg-accent text-black hover:bg-accent-strong"
                : "border-bg-border text-neutral-200 hover:border-accent hover:text-neutral-100"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <PreviousBlockButton onClick={onPrevious} disabled={!canPrevious} />
          <SkipBlockButton onClick={onSkip} />
          <button
            type="button"
            onClick={onEnd}
            className="rounded-lg border border-bg-border px-3 py-2 text-sm text-neutral-300 transition hover:border-red-900 hover:text-red-300"
          >
            End
          </button>
        </div>
      </div>

      {awaiting && !paused && (
        <div role="status" className="mt-3 rounded-lg border border-accent/40 bg-bg-elevated px-4 py-3 text-center text-sm text-neutral-200">
          {nextBlock ? `Finish your pass. Next: ${displayNextLabel}${nextTempoBpm != null && nextTempoBpm > 0 ? ` (${nextTempoBpm} BPM)` : ""}.` : "Timer finished. Adjust BPM, repeat, or finish your session."}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 pt-2">
        {currentBlock && (
          <BlockHeader
            label={displayCurrentLabel}
            tempoBpm={tempoBpm}
            blockIndex={blockIndex}
            totalBlocks={totalBlocks}
          />
        )}

        {showMetronomeIndicator && <MetronomeIndicator metronome={metronome} />}

        {isUnbounded ? (
          <BlockCountUp seconds={elapsedSec} />
        ) : (
          <BlockCountdown seconds={timeLeftSec} />
        )}

        {currentBlock && !awaiting && <BlockInstructions items={currentBlock.instructions} />}
        {notesPanel}
      </div>

      <div className="flex w-full shrink-0 flex-col items-center justify-center gap-3 pt-2">
        {beforePrimaryControls}

        {awaiting && showEarnedButton && (
          <EarnedButton onClick={onEarned} disabled={false} compact />
        )}

        {awaiting ? (
          !nextBlock ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {onRepeatSession && <button type="button" onClick={onRepeatSession} className="rounded-xl border border-accent px-6 py-5 text-xl font-semibold text-accent">Repeat session</button>}
              <button
                type="button"
                onClick={onRepeatBlock}
                className="rounded-xl border border-bg-border bg-bg-elevated px-8 py-5 text-xl font-semibold text-neutral-100 transition hover:bg-bg-elevated/80"
              >
                Repeat block
              </button>
              <button
                type="button"
                onClick={onAdvance}
                className="rounded-xl bg-accent px-10 py-5 text-2xl font-bold text-black shadow-lg transition hover:bg-accent-strong"
              >
                Finish
                <span className="ml-3 text-sm font-normal opacity-70">
                  (Space)
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdvance}
              className="rounded-xl bg-accent px-10 py-5 text-2xl font-bold text-black shadow-lg transition hover:bg-accent-strong"
            >
              Continue - {displayNextLabel}
              <span className="ml-3 text-sm font-normal opacity-70">
                (Space)
              </span>
            </button>
          )
        ) : isUnbounded ? (
          <button
            type="button"
            onClick={onUnboundedAction ?? onAdvance}
            className="rounded-xl bg-accent px-10 py-5 text-2xl font-bold text-black shadow-lg transition hover:bg-accent-strong"
          >
            {unboundedActionLabel ??
              `Finish warm-up - ${nextBlock ? displayNextLabel : "Finish"}`}
            <span className="ml-3 text-sm font-normal opacity-70">
              {unboundedActionShortcut}
            </span>
          </button>
        ) : (
          <EarnedButton
            onClick={onEarned}
            disabled={!showEarnedButton}
            hint={earnedHint}
          />
        )}
      </div>

      <div className="shrink-0 pt-3">
        <ShortcutsHint />
      </div>

      {paused && (
        <div className="pointer-events-auto absolute inset-0 flex items-start justify-center bg-bg/60 pt-24 backdrop-blur-[2px]">
          <div className="pointer-events-none text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Paused
            </div>
            <div className="mt-3 text-5xl font-bold text-accent">Pause</div>
            <div className="mt-3 text-xs uppercase tracking-wider text-neutral-500">
              Press <span className="font-mono text-neutral-300">P</span> or
              click Resume to continue
            </div>
          </div>
        </div>
      )}


      {children}

      <div className="pointer-events-none fixed bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-black shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
