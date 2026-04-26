import type { BlockDef } from "@/types/block";
import type { Song } from "@/types/song";
import {
  fiveMinSlowReferenceBpm,
  overspeedBpm,
  slowMusicalBpm,
  slowReferenceBpm,
  targetBpm,
  troubleBlockBpmFor,
  warmupBpmFor,
} from "./tempo";

export const INSTRUCTIONS: Record<string, string[]> = {
  consciousPractice: [
    "Very slow, very conscious — one click, one note.",
    "Feel every motion of each hand. Land exactly on the click.",
    "Timer counts up — end the block when you feel warmed up.",
  ],
  slowReference: [
    "Play the full tune, slowly and relaxed.",
    "You're not chasing anything — this is a warm-up.",
    "Listen for tone, check pick angle, notice any tension.",
  ],
  troubleSpot: [
    "Loop just the hardest 1–2 bars of the tune.",
    "Play them at a tempo where they are GENUINELY clean in isolation.",
    "Three consecutive clean-and-relaxed reps earns the next rung — tap 'I earned it'.",
    "If you stack 3 tense reps, drop the tempo and reset the feel.",
  ],
  ceilingWork: [
    "Full tune at the target tempo — this is the push.",
    "Three consecutive clean-and-relaxed reps earns a new working tempo.",
    "Tense-survival reps don't count. If three tense reps stack up, drop back.",
  ],
  overspeed: [
    "One or two fast bursts above your target. Messy is OK.",
    "The point is to make the target tempo feel slow when you drop back.",
    "Don't try to earn anything here — just push.",
  ],
  consolidation: [
    "One or two deliberate, relaxed reps at your working tempo.",
    "This is the version your brain rehearses overnight — make it clean.",
    "End on a clean rep. Always.",
  ],
  slowMusical: [
    "One full pass, played musically.",
    "Lean into swing, breathe between phrases, let open strings ring.",
    "Remember this is a tune, not a metronome drill.",
  ],
  exerciseBuild: [
    "Working tempo — internalize the motion cleanly.",
    "Three consecutive clean-and-relaxed reps earns a new working tempo — tap +.",
    "If three tense reps stack, drop the tempo and reset the feel.",
  ],
  exerciseCoolDown: [
    "Slow and relaxed — release any tension from the burst.",
    "Last reps of the session — make them the cleanest.",
    "End on a clean rep. Always.",
  ],
};

/**
 * Conscious Practice warm-up. Prepended once to every session regardless
 * of length. `unbounded: true` means the driver never auto-advances off it;
 * the player presses N / Next when they're ready. Metronome plays at the
 * song's saved `warmupBpm` if set, else ⅓ × workingBpm (floored at 20).
 * The session page offers an in-session 2× slower toggle that is not
 * persisted; the explicit "Set BPM…" value persists on the song.
 */
export const CONSCIOUS_PRACTICE_BLOCK: BlockDef = {
  kind: "consciousPractice",
  label: "Conscious Practice",
  durationSec: 0,
  unbounded: true,
  tempoFn: warmupBpmFor,
  showEarnedButton: false,
  promotes: null,
  instructions: INSTRUCTIONS.consciousPractice,
};

// Canonical 10-minute template with exactly one Trouble Spot block.
// Longer sessions scale every block proportionally; `buildBlocks` then
// replicates the trouble block once per song trouble spot.
export const BASE_TEN_MIN_BLOCKS: BlockDef[] = [
  {
    kind: "slowReference",
    label: "Slow Reference",
    durationSec: 90,
    tempoFn: slowReferenceBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.slowReference,
  },
  {
    kind: "troubleSpot",
    label: "Trouble Spot",
    durationSec: 120,
    tempoFn: (s) => troubleBlockBpmFor(s, 0),
    showEarnedButton: true,
    promotes: { kind: "trouble", index: 0 },
    instructions: INSTRUCTIONS.troubleSpot,
  },
  {
    kind: "ceilingWork",
    label: "Ceiling Work",
    durationSec: 180,
    tempoFn: targetBpm,
    showEarnedButton: true,
    promotes: { kind: "working" },
    instructions: INSTRUCTIONS.ceilingWork,
  },
  {
    kind: "overspeed",
    label: "Overspeed",
    durationSec: 60,
    tempoFn: overspeedBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.overspeed,
  },
  {
    kind: "consolidation",
    label: "Consolidation",
    durationSec: 90,
    tempoFn: (s) => s.workingBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.consolidation,
  },
  {
    kind: "slowMusical",
    label: "Slow Musical",
    durationSec: 60,
    tempoFn: slowMusicalBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.slowMusical,
  },
];

// Compact 5-minute form. Has no trouble-spot block by design — trouble-spot
// isolation belongs to the longer session shapes.
export const FIVE_MIN_BLOCKS: BlockDef[] = [
  {
    kind: "slowReference",
    label: "Slow Reference",
    durationSec: 60,
    tempoFn: fiveMinSlowReferenceBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.slowReference,
  },
  {
    kind: "ceilingWork",
    label: "Ceiling Work",
    durationSec: 150,
    tempoFn: targetBpm,
    showEarnedButton: true,
    promotes: { kind: "working" },
    instructions: INSTRUCTIONS.ceilingWork,
  },
  {
    kind: "overspeed",
    label: "Overspeed",
    durationSec: 45,
    tempoFn: overspeedBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.overspeed,
  },
  {
    kind: "consolidation",
    label: "Consolidation",
    durationSec: 45,
    tempoFn: (s) => s.workingBpm,
    showEarnedButton: false,
    promotes: null,
    instructions: INSTRUCTIONS.consolidation,
  },
];

export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 60;

export const clampSessionMinutes = (n: number): number => {
  if (!Number.isFinite(n)) return 10;
  const rounded = Math.round(n);
  if (rounded < MIN_SESSION_MINUTES) return MIN_SESSION_MINUTES;
  if (rounded > MAX_SESSION_MINUTES) return MAX_SESSION_MINUTES;
  return rounded;
};

/**
 * Total scheduled playing time in seconds for a given base minutes + song.
 * Mirrors the logic inside `buildBlocks` without instantiating the blocks.
 * Note: this is only the metronome-on time. The session now waits for the
 * user to press Space between blocks, so the actual wall-clock duration is
 * always longer than this — and the waiting time still counts toward the
 * song's `totalPracticeSec`.
 */
export const sessionLengthSec = (minutes: number, song: Song): number => {
  if (minutes === 5) {
    return FIVE_MIN_BLOCKS.reduce((a, b) => a + b.durationSec, 0);
  }
  const scale = minutes / 10;
  const scaledTroubleSec = Math.round(120 * scale);
  const count = song.troubleSpots.length;
  if (count === 0) return minutes * 60 - scaledTroubleSec;
  return minutes * 60 + (count - 1) * scaledTroubleSec;
};

/**
 * Build the block list for a session of `minutes` base minutes against a
 * specific song. Scales block durations proportionally from the canonical
 * 10-minute template, then replaces the single trouble-spot block with
 * one block per song trouble spot. Rounding residual is absorbed into the
 * Ceiling Work block so totals land exactly on `sessionLengthSec`.
 */
export const buildBlocks = (minutes: number, song: Song): BlockDef[] => {
  if (minutes === 5) return [CONSCIOUS_PRACTICE_BLOCK, ...FIVE_MIN_BLOCKS];

  const scale = minutes / 10;
  const count = song.troubleSpots.length;

  const scaled = BASE_TEN_MIN_BLOCKS.map((b) => ({
    ...b,
    durationSec: Math.round(b.durationSec * scale),
  }));

  const scaledTroubleSec = Math.round(120 * scale);

  const result: BlockDef[] = [CONSCIOUS_PRACTICE_BLOCK];
  for (const b of scaled) {
    if (b.kind !== "troubleSpot") {
      result.push(b);
      continue;
    }
    for (let i = 0; i < count; i++) {
      result.push({
        kind: "troubleSpot",
        label: count > 1 ? `Trouble Spot ${i + 1}` : "Trouble Spot",
        durationSec: scaledTroubleSec,
        tempoFn: (s: Song) => troubleBlockBpmFor(s, i),
        showEarnedButton: true,
        promotes: { kind: "trouble", index: i },
        instructions: INSTRUCTIONS.troubleSpot,
      });
    }
    // count === 0 → skip entirely, no trouble block added
  }

  const target = sessionLengthSec(minutes, song);
  const actual = result.reduce((a, b) => a + b.durationSec, 0);
  const residual = target - actual;
  if (residual !== 0) {
    const ceilingIdx = result.findIndex((b) => b.kind === "ceilingWork");
    if (ceilingIdx >= 0) {
      result[ceilingIdx] = {
        ...result[ceilingIdx],
        durationSec: result[ceilingIdx].durationSec + residual,
      };
    }
  }

  return result;
};

