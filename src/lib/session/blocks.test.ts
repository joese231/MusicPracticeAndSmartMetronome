import { describe, it, expect } from "vitest";
import {
  BASE_TEN_MIN_BLOCKS,
  FIVE_MIN_BLOCKS,
  INSTRUCTIONS,
  buildBlocks,
  sessionLengthSec,
} from "./blocks";
import type { Song, TroubleSpot } from "@/types/song";

const makeSong = (spots: TroubleSpot[] = [{ bpm: 150 }]): Song => ({
  id: "s1",
  title: "Test",
  link: null,
  workingBpm: 220,
  warmupBpm: null,
  troubleSpots: spots,
  originalBpm: null,
  stepPercent: 2.5,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "",
  updatedAt: "",
});

const sumDur = (blocks: { durationSec: number }[]): number =>
  blocks.reduce((a, b) => a + b.durationSec, 0);


describe("template block definitions", () => {
  it("BASE_TEN_MIN_BLOCKS sum to 600 seconds", () => {
    expect(sumDur(BASE_TEN_MIN_BLOCKS)).toBe(600);
  });

  it("FIVE_MIN_BLOCKS sum to 300 seconds", () => {
    expect(sumDur(FIVE_MIN_BLOCKS)).toBe(300);
  });

  it("every template block has instructions", () => {
    for (const block of [...BASE_TEN_MIN_BLOCKS, ...FIVE_MIN_BLOCKS]) {
      expect(block.instructions.length).toBeGreaterThan(0);
    }
  });

  it("INSTRUCTIONS map covers every block kind used", () => {
    for (const block of BASE_TEN_MIN_BLOCKS) {
      expect(INSTRUCTIONS[block.kind]).toBeDefined();
    }
  });

  it("BASE_TEN_MIN_BLOCKS tempoFns produce sane numbers for a known song", () => {
    const song = makeSong([{ bpm: 150 }]);
    const [slowRef, trouble, ceiling, over, consol, slowMus] = BASE_TEN_MIN_BLOCKS;
    expect(slowRef.tempoFn(song)).toBe(Math.round(220 * 0.77));
    expect(trouble.tempoFn(song)).toBe(150);
    expect(ceiling.tempoFn(song)).toBe(226);
    expect(over.tempoFn(song)).toBe(232);
    expect(consol.tempoFn(song)).toBe(220);
    expect(slowMus.tempoFn(song)).toBe(Math.round(220 * 0.72));
  });
});

describe("buildBlocks — Conscious Practice prefix", () => {
  it("always prepends the unbounded Conscious Practice block", () => {
    for (const minutes of [5, 10, 15, 30]) {
      const blocks = buildBlocks(minutes, makeSong());
      expect(blocks[0].kind).toBe("consciousPractice");
      expect(blocks[0].unbounded).toBe(true);
      expect(blocks[0].durationSec).toBe(0);
    }
  });

  it("Conscious Practice tempo is one third of working BPM, floored at 20", () => {
    const blocks = buildBlocks(10, makeSong());
    expect(blocks[0].tempoFn(makeSong())).toBe(Math.round(220 / 3));
    const veryslow = { ...makeSong(), workingBpm: 40 };
    expect(blocks[0].tempoFn(veryslow)).toBe(20);
  });
});

describe("buildBlocks — 5-minute compact", () => {
  it("returns Conscious Practice followed by FIVE_MIN_BLOCKS unchanged", () => {
    const blocks = buildBlocks(5, makeSong([]));
    expect(blocks[0].kind).toBe("consciousPractice");
    expect(blocks.slice(1)).toEqual(FIVE_MIN_BLOCKS);

    const withSpots = buildBlocks(5, makeSong([{ bpm: 150 }, { bpm: 180 }]));
    expect(withSpots.slice(1)).toEqual(FIVE_MIN_BLOCKS);
  });

  it("5-min blocks contain no trouble-spot block", () => {
    const blocks = buildBlocks(5, makeSong([{ bpm: 150 }, { bpm: 180 }]));
    expect(blocks.some((b) => b.kind === "troubleSpot")).toBe(false);
  });
});

describe("buildBlocks — 10 minute base", () => {
  it("1 trouble spot: 7 blocks (incl. Conscious), sums to 600 s, matches template durations", () => {
    const blocks = buildBlocks(10, makeSong([{ bpm: 150 }]));
    expect(blocks).toHaveLength(7);
    expect(sumDur(blocks)).toBe(600);
    expect(blocks.slice(1).map((b) => b.durationSec)).toEqual(
      BASE_TEN_MIN_BLOCKS.map((b) => b.durationSec),
    );
  });

  it("0 trouble spots: 6 blocks, sums to 480 s", () => {
    const blocks = buildBlocks(10, makeSong([]));
    expect(blocks).toHaveLength(6);
    expect(sumDur(blocks)).toBe(480);
    expect(blocks.some((b) => b.kind === "troubleSpot")).toBe(false);
  });

  it("3 trouble spots: 9 blocks, sums to 840 s, each trouble block is 120 s", () => {
    const blocks = buildBlocks(10, makeSong([{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]));
    expect(blocks).toHaveLength(9);
    expect(sumDur(blocks)).toBe(840);
    const troubleBlocks = blocks.filter((b) => b.kind === "troubleSpot");
    expect(troubleBlocks).toHaveLength(3);
    expect(troubleBlocks.every((b) => b.durationSec === 120)).toBe(true);
  });

  it("each trouble block reads its own spot's BPM via tempoFn", () => {
    const song = makeSong([{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]);
    const troubleBlocks = buildBlocks(10, song).filter((b) => b.kind === "troubleSpot");
    expect(troubleBlocks[0].tempoFn(song)).toBe(150);
    expect(troubleBlocks[1].tempoFn(song)).toBe(160);
    expect(troubleBlocks[2].tempoFn(song)).toBe(170);
  });

  it("each trouble block promotes its own index", () => {
    const song = makeSong([{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]);
    const troubleBlocks = buildBlocks(10, song).filter((b) => b.kind === "troubleSpot");
    expect(troubleBlocks[0].promotes).toEqual({ kind: "trouble", index: 0 });
    expect(troubleBlocks[1].promotes).toEqual({ kind: "trouble", index: 1 });
    expect(troubleBlocks[2].promotes).toEqual({ kind: "trouble", index: 2 });
  });

  it("ceiling block still promotes working", () => {
    const blocks = buildBlocks(10, makeSong([{ bpm: 150 }]));
    const ceiling = blocks.find((b) => b.kind === "ceilingWork");
    expect(ceiling?.promotes).toEqual({ kind: "working" });
  });
});

describe("buildBlocks — scaling to longer durations", () => {
  it("15 min with 1 spot sums to exactly 900 s", () => {
    const blocks = buildBlocks(15, makeSong([{ bpm: 150 }]));
    expect(sumDur(blocks)).toBe(900);
  });

  it("15 min blocks are round(base × 1.5)", () => {
    const blocks = buildBlocks(15, makeSong([{ bpm: 150 }]));
    const expected = BASE_TEN_MIN_BLOCKS.map((b) => Math.round(b.durationSec * 1.5));
    expect(blocks.slice(1).map((b) => b.durationSec)).toEqual(expected);
  });

  it("20 min with 2 spots: 8 blocks (incl. Conscious), sums to 1440 s", () => {
    const blocks = buildBlocks(20, makeSong([{ bpm: 150 }, { bpm: 160 }]));
    expect(blocks).toHaveLength(8);
    expect(sumDur(blocks)).toBe(1440);
  });

  it("30 min with 1 spot sums to exactly 1800 s", () => {
    const blocks = buildBlocks(30, makeSong([{ bpm: 150 }]));
    expect(sumDur(blocks)).toBe(1800);
  });
});

describe("sessionLengthSec", () => {
  it("matches buildBlocks totals across a range of configurations", () => {
    const configs: [number, TroubleSpot[]][] = [
      [5, []],
      [5, [{ bpm: 150 }]],
      [10, []],
      [10, [{ bpm: 150 }]],
      [10, [{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]],
      [15, [{ bpm: 150 }]],
      [20, [{ bpm: 150 }, { bpm: 160 }]],
      [30, [{ bpm: 150 }]],
    ];
    for (const [minutes, spots] of configs) {
      const song = makeSong(spots);
      expect(sessionLengthSec(minutes, song)).toBe(sumDur(buildBlocks(minutes, song)));
    }
  });
});
