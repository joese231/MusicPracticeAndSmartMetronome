import type { BlockDef, DriverSnapshot } from "@/types/block";

/**
 * Initial driver snapshot for a fresh session. The first block starts in
 * `playing` phase immediately — the caller is expected to have already
 * started the metronome inside the user-gesture click handler.
 */
export const initialSnapshot = (nowMs: number): DriverSnapshot => ({
  blockIndex: 0,
  phase: "playing",
  blockStartMs: nowMs,
});

/**
 * Seconds remaining in the current `playing` phase. Returns 0 for any
 * non-playing phase or when the block has already run out. For unbounded
 * blocks (e.g. Conscious Practice), returns Infinity — the caller should
 * switch to a count-up display instead of a countdown.
 */
export const timeLeftInPlayingSec = (
  snap: DriverSnapshot,
  blocks: BlockDef[],
  nowMs: number,
): number => {
  if (snap.phase !== "playing") return 0;
  const block = blocks[snap.blockIndex];
  if (!block) return 0;
  if (block.unbounded) return Infinity;
  const elapsed = (nowMs - snap.blockStartMs) / 1000;
  return Math.max(0, block.durationSec - elapsed);
};

/** Seconds elapsed in the current `playing` phase. Used by count-up blocks. */
export const elapsedInPlayingSec = (
  snap: DriverSnapshot,
  nowMs: number,
): number => {
  if (snap.phase !== "playing") return 0;
  return Math.max(0, (nowMs - snap.blockStartMs) / 1000);
};

/**
 * Called on every tick. When a playing block runs out of time, flips to
 * `awaiting` — but does NOT auto-advance. The caller pauses the metronome
 * and plays a chime on that transition. Unbounded blocks never auto-flip;
 * only an explicit advance moves off them.
 */
export const tickSnapshot = (
  snap: DriverSnapshot,
  blocks: BlockDef[],
  nowMs: number,
): DriverSnapshot => {
  if (snap.phase !== "playing") return snap;
  const block = blocks[snap.blockIndex];
  if (!block || block.unbounded) return snap;
  if (timeLeftInPlayingSec(snap, blocks, nowMs) > 0) return snap;
  return { ...snap, phase: "awaiting" };
};

/**
 * Move on to the next block. Works from both `playing` (skip early) and
 * `awaiting` (the normal path triggered by Space / Continue). Returns an
 * `ended` snapshot after the final block.
 */
export const advanceSnapshot = (
  snap: DriverSnapshot,
  blocks: BlockDef[],
  nowMs: number,
): DriverSnapshot => {
  if (snap.phase === "ended") return snap;
  const next = snap.blockIndex + 1;
  if (next >= blocks.length) {
    return { ...snap, phase: "ended" };
  }
  return { blockIndex: next, phase: "playing", blockStartMs: nowMs };
};

/**
 * Step back to the previous block. No-ops at block 0. Returns to `playing`
 * phase with a fresh `blockStartMs` so the restored block gets a full
 * countdown.
 */
export const rewindSnapshot = (
  snap: DriverSnapshot,
  blocks: BlockDef[],
  nowMs: number,
): DriverSnapshot => {
  if (snap.phase === "ended") return snap;
  const prev = snap.blockIndex - 1;
  if (prev < 0) return snap;
  if (!blocks[prev]) return snap;
  return { blockIndex: prev, phase: "playing", blockStartMs: nowMs };
};

/** Total seconds of scheduled playing time — excludes any awaiting gaps. */
export const totalPlayingSec = (blocks: BlockDef[]): number =>
  blocks.reduce((a, b) => a + b.durationSec, 0);
