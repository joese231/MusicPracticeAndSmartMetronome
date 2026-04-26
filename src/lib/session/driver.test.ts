import { describe, it, expect } from "vitest";
import {
  advanceSnapshot,
  initialSnapshot,
  rewindSnapshot,
  tickSnapshot,
  timeLeftInPlayingSec,
  totalPlayingSec,
} from "./driver";
import { buildBlocks, FIVE_MIN_BLOCKS } from "./blocks";
import type { Song, TroubleSpot } from "@/types/song";
import type { DriverSnapshot } from "@/types/block";

const makeSong = (overrides: Partial<Song> = {}): Song => ({
  id: "s1",
  title: "Test",
  link: null,
  workingBpm: 220,
  warmupBpm: null,
  troubleSpots: [{ bpm: 150 }],
  originalBpm: null,
  stepPercent: 2.5,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("totalPlayingSec", () => {
  it("10-min blocks total 600s of playing time (Conscious Practice contributes 0)", () => {
    const blocks = buildBlocks(10, makeSong());
    expect(totalPlayingSec(blocks)).toBe(600);
  });

  it("5-min blocks total 300s of playing time", () => {
    expect(totalPlayingSec(FIVE_MIN_BLOCKS)).toBe(300);
  });
});

describe("initialSnapshot", () => {
  it("starts at block 0, playing, at the given wall-clock time", () => {
    const snap = initialSnapshot(1000);
    expect(snap.blockIndex).toBe(0);
    expect(snap.phase).toBe("playing");
    expect(snap.blockStartMs).toBe(1000);
  });
});

describe("timeLeftInPlayingSec", () => {
  const song = makeSong();
  const blocks = buildBlocks(10, song);
  // Block 0 is the unbounded Conscious Practice warm-up; countdown semantics
  // are only meaningful on the timed blocks that follow.
  const firstTimedIdx = 1;

  it("returns the full block duration at block start", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "playing",
      blockStartMs: 1000,
    };
    expect(timeLeftInPlayingSec(snap, blocks, 1000)).toBe(
      blocks[firstTimedIdx].durationSec,
    );
  });

  it("counts down as time passes", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "playing",
      blockStartMs: 1000,
    };
    expect(timeLeftInPlayingSec(snap, blocks, 1000 + 30_000)).toBe(
      blocks[firstTimedIdx].durationSec - 30,
    );
  });

  it("clamps to 0 past the end of the block", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "playing",
      blockStartMs: 1000,
    };
    const past = 1000 + (blocks[firstTimedIdx].durationSec + 10) * 1000;
    expect(timeLeftInPlayingSec(snap, blocks, past)).toBe(0);
  });

  it("returns 0 when phase is awaiting", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "awaiting",
      blockStartMs: 1000,
    };
    expect(timeLeftInPlayingSec(snap, blocks, 1000)).toBe(0);
  });

  it("returns Infinity for an unbounded block", () => {
    const snap: DriverSnapshot = {
      blockIndex: 0,
      phase: "playing",
      blockStartMs: 1000,
    };
    expect(timeLeftInPlayingSec(snap, blocks, 999_999)).toBe(Infinity);
  });
});

describe("tickSnapshot", () => {
  const song = makeSong();
  const blocks = buildBlocks(10, song);
  // Block 0 is unbounded — auto-transition is disabled for it.
  const firstTimedIdx = 1;

  it("returns the same reference while still playing", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "playing",
      blockStartMs: 1000,
    };
    const next = tickSnapshot(snap, blocks, 1500);
    expect(next).toBe(snap);
  });

  it("flips to awaiting exactly when the block time is up", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "playing",
      blockStartMs: 1000,
    };
    const endMs = 1000 + blocks[firstTimedIdx].durationSec * 1000;
    const next = tickSnapshot(snap, blocks, endMs);
    expect(next.phase).toBe("awaiting");
    expect(next.blockIndex).toBe(firstTimedIdx);
  });

  it("does not mutate an already-awaiting snapshot", () => {
    const snap: DriverSnapshot = {
      blockIndex: firstTimedIdx,
      phase: "awaiting",
      blockStartMs: 1000,
    };
    const next = tickSnapshot(snap, blocks, 999_999);
    expect(next).toBe(snap);
  });

  it("never auto-transitions an unbounded block", () => {
    const snap = initialSnapshot(1000);
    // Any amount of elapsed time — the Conscious Practice block stays playing.
    const next = tickSnapshot(snap, blocks, 999_999_999);
    expect(next).toBe(snap);
  });
});

describe("advanceSnapshot", () => {
  const song = makeSong();
  const blocks = buildBlocks(10, song);

  it("moves from awaiting into the next playing block", () => {
    const snap: DriverSnapshot = {
      blockIndex: 0,
      phase: "awaiting",
      blockStartMs: 0,
    };
    const next = advanceSnapshot(snap, blocks, 5000);
    expect(next.phase).toBe("playing");
    expect(next.blockIndex).toBe(1);
    expect(next.blockStartMs).toBe(5000);
  });

  it("also works from playing (skip)", () => {
    const snap = initialSnapshot(0);
    const next = advanceSnapshot(snap, blocks, 5000);
    expect(next.phase).toBe("playing");
    expect(next.blockIndex).toBe(1);
  });

  it("returns ended after the final block", () => {
    const snap: DriverSnapshot = {
      blockIndex: blocks.length - 1,
      phase: "awaiting",
      blockStartMs: 0,
    };
    const next = advanceSnapshot(snap, blocks, 5000);
    expect(next.phase).toBe("ended");
  });

  it("ended snapshot is idempotent", () => {
    const snap: DriverSnapshot = {
      blockIndex: blocks.length - 1,
      phase: "ended",
      blockStartMs: 0,
    };
    expect(advanceSnapshot(snap, blocks, 1)).toBe(snap);
  });
});

describe("full session walkthrough", () => {
  it("steps through every block and terminates at ended", () => {
    const song = makeSong();
    const blocks = buildBlocks(10, song);

    let snap: DriverSnapshot = initialSnapshot(0);
    let t = 0;

    for (let i = 0; i < blocks.length; i++) {
      expect(snap.phase).toBe("playing");
      expect(snap.blockIndex).toBe(i);

      if (blocks[i].unbounded) {
        // Unbounded blocks (Conscious Practice) only leave `playing` on an
        // explicit user advance — no tickSnapshot auto-flip.
        t += 30_000;
      } else {
        // Run the block to completion.
        t = snap.blockStartMs + blocks[i].durationSec * 1000;
        snap = tickSnapshot(snap, blocks, t);
        expect(snap.phase).toBe("awaiting");
        t += 2000;
      }

      snap = advanceSnapshot(snap, blocks, t);
    }

    expect(snap.phase).toBe("ended");
  });
});

describe("multi-trouble session shape", () => {
  it("builds one trouble block per song trouble spot", () => {
    const spots: TroubleSpot[] = [{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }];
    const song = makeSong({ troubleSpots: spots });
    const blocks = buildBlocks(10, song);

    const troubleCount = blocks.filter((b) => b.kind === "troubleSpot").length;
    expect(troubleCount).toBe(3);

    const troubleBlocks = blocks.filter((b) => b.kind === "troubleSpot");
    troubleBlocks.forEach((b, i) => {
      expect(b.tempoFn(song)).toBe(spots[i].bpm);
    });
  });
});

describe("rewindSnapshot", () => {
  it("steps back one block and enters playing phase", () => {
    const blocks = buildBlocks(10, makeSong());
    const snap: DriverSnapshot = {
      blockIndex: 2,
      phase: "awaiting",
      blockStartMs: 1000,
    };
    const next = rewindSnapshot(snap, blocks, 5000);
    expect(next.blockIndex).toBe(1);
    expect(next.phase).toBe("playing");
    expect(next.blockStartMs).toBe(5000);
  });

  it("no-ops at block 0", () => {
    const blocks = buildBlocks(10, makeSong());
    const snap = initialSnapshot(0);
    const next = rewindSnapshot(snap, blocks, 1000);
    expect(next).toBe(snap);
  });

  it("no-ops when ended", () => {
    const blocks = buildBlocks(10, makeSong());
    const snap: DriverSnapshot = {
      blockIndex: 3,
      phase: "ended",
      blockStartMs: 0,
    };
    const next = rewindSnapshot(snap, blocks, 1000);
    expect(next).toBe(snap);
  });
});
