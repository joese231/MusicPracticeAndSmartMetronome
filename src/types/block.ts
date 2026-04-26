import type { Song } from "./song";

export type BlockKind =
  | "consciousPractice"
  | "slowReference"
  | "troubleSpot"
  | "ceilingWork"
  | "overspeed"
  | "consolidation"
  | "slowMusical"
  | "exerciseBuild"
  | "exerciseCoolDown";

export type BlockPromotion =
  | { kind: "working" }
  | { kind: "trouble"; index: number }
  | null;

export type BlockDef = {
  kind: BlockKind;
  label: string;
  /** Seconds the block should run. Ignored when `unbounded` is true. */
  durationSec: number;
  tempoFn: (song: Song) => number;
  showEarnedButton: boolean;
  promotes: BlockPromotion;
  instructions: string[];
  /**
   * When true, the block runs on a count-up timer and only leaves `playing`
   * phase on an explicit advance (N / Next button). `durationSec` is unused.
   */
  unbounded?: boolean;
};

/**
 * `playing` — metronome is running, countdown ticking down inside a block.
 * `awaiting` — block's time is up, metronome paused, waiting for the user
 *   to press Space (or click Continue) to move on. This lets the player
 *   finish the current repetition of the tune before advancing.
 * `ended` — session complete.
 */
export type DriverPhase = "playing" | "awaiting" | "ended";

/** Pure state for the session driver. No React, no side effects. */
export type DriverSnapshot = {
  blockIndex: number;
  phase: DriverPhase;
  /** Wall-clock ms when the current `playing` phase started. */
  blockStartMs: number;
};
