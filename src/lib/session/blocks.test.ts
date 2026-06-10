import { describe, it, expect } from "vitest";
import {
  buildBlocks,
  INSTRUCTIONS,
  sessionLengthSec,
  songBlockStructureKey,
} from "./blocks";
import {
  cloneSongTemplate,
  DEFAULT_SONG_BLOCK_TEMPLATE,
  migrateSongTemplate,
} from "@/types/song";
import type { Song, SongBlockTemplate, TroubleSpot } from "@/types/song";
import { evaluateTempoRule } from "./tempoRules";

const makeSong = (
  spots: TroubleSpot[] = [{ bpm: 150 }],
  overrides: Partial<Song> = {},
): Song => ({
  id: "s1",
  title: "Test",
  link: null,
  workingBpm: 220,
  warmupBpm: null,
  troubleSpots: spots,
  originalBpm: null,
  stepPercent: 2.5,
  practiceMode: "smart",
  includeWarmupBlock: true,
  defaultSessionMinutes: 10,
  metronomeEnabled: true,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const sumDur = (blocks: { durationSec: number }[]): number =>
  blocks.reduce((a, b) => a + b.durationSec, 0);

describe("default song template", () => {
  it("contains the five block roles, all enabled", () => {
    expect(DEFAULT_SONG_BLOCK_TEMPLATE.map((e) => e.role)).toEqual([
      "slowReference",
      "troubleSpot",
      "ceilingWork",
      "overspeed",
      "consolidation",
    ]);
    expect(DEFAULT_SONG_BLOCK_TEMPLATE.every((e) => e.enabled)).toBe(true);
  });

  it("duration percents preserve the legacy 540 total share", () => {
    expect(
      DEFAULT_SONG_BLOCK_TEMPLATE.reduce(
        (a, e) => a + (e.duration.kind === "percent" ? e.duration.percent : 0),
        0,
      ),
    ).toBe(540);
  });

  it("recipes carry instructions for every default block role", () => {
    for (const entry of DEFAULT_SONG_BLOCK_TEMPLATE) {
      expect(entry.instructions.length).toBeGreaterThan(0);
      if (entry.role !== "custom") expect(INSTRUCTIONS[entry.role]).toBeDefined();
    }
  });

  it("default recipes produce sane tempos for a known song", () => {
    const song = makeSong([{ bpm: 150 }]);
    const byRole = new Map(DEFAULT_SONG_BLOCK_TEMPLATE.map((e) => [e.role, e]));
    expect(evaluateTempoRule(byRole.get("slowReference")!.tempoRule, song)).toBe(176);
    expect(
      evaluateTempoRule(byRole.get("troubleSpot")!.tempoRule, song, {
        troubleIndex: 0,
      }),
    ).toBe(150);
    expect(evaluateTempoRule(byRole.get("ceilingWork")!.tempoRule, song)).toBe(226);
    expect(evaluateTempoRule(byRole.get("overspeed")!.tempoRule, song)).toBe(232);
    expect(evaluateTempoRule(byRole.get("consolidation")!.tempoRule, song)).toBe(154);
  });
});

describe("migrateSongTemplate", () => {
  it("returns the default for empty / missing input", () => {
    expect(migrateSongTemplate(undefined)).toEqual(DEFAULT_SONG_BLOCK_TEMPLATE);
    expect(migrateSongTemplate(null)).toEqual(DEFAULT_SONG_BLOCK_TEMPLATE);
    expect(migrateSongTemplate([])).toEqual(DEFAULT_SONG_BLOCK_TEMPLATE);
  });

  it("rewrites a lone slowMusical entry into consolidation", () => {
    const out = migrateSongTemplate([
      { kind: "slowMusical" as never, enabled: true, weight: 60 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("consolidation");
    expect(out[0].enabled).toBe(true);
    expect(out[0].duration).toEqual({ kind: "percent", percent: 60 });
  });

  it("merges weights when both consolidation and slowMusical are present (sum + OR enabled)", () => {
    const out = migrateSongTemplate([
      { kind: "slowReference", enabled: true, weight: 90 },
      { kind: "consolidation", enabled: false, weight: 90 },
      { kind: "slowMusical" as never, enabled: true, weight: 60 },
    ]);
    expect(out.map((e) => e.role)).toEqual(["slowReference", "consolidation"]);
    expect(out[0].duration).toEqual({ kind: "percent", percent: 90 });
    expect(out[1].enabled).toBe(true);
    expect(out[1].duration).toEqual({ kind: "percent", percent: 150 });
  });

  it("passes through templates that contain no slowMusical entries", () => {
    const input: SongBlockTemplate = cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE);
    expect(migrateSongTemplate(input)).toEqual(input);
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

  it("includeWarmupBlock = false drops the prefix", () => {
    const blocks = buildBlocks(10, makeSong([], { includeWarmupBlock: false }));
    expect(blocks.some((b) => b.kind === "consciousPractice")).toBe(false);
  });
});

describe("buildBlocks — default template totals", () => {
  it("10 min with 1 trouble spot allocates the full session length", () => {
    const blocks = buildBlocks(10, makeSong([{ bpm: 150 }]));
    // 6 = Conscious + 5 default rows (troubleSpot replicated once)
    expect(blocks).toHaveLength(6);
    expect(sumDur(blocks)).toBe(600);
  });

  it("10 min with 0 trouble spots: troubleSpot row drops, time redistributes", () => {
    const blocks = buildBlocks(10, makeSong([]));
    expect(blocks.some((b) => b.kind === "troubleSpot")).toBe(false);
    // Body still totals 600 — full session length is preserved.
    expect(sumDur(blocks)).toBe(600);
  });

  it("10 min with 3 trouble spots: trouble row replicates and shares its allocation", () => {
    const blocks = buildBlocks(
      10,
      makeSong([{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]),
    );
    expect(sumDur(blocks)).toBe(600);
    const troubleBlocks = blocks.filter((b) => b.kind === "troubleSpot");
    expect(troubleBlocks).toHaveLength(3);
    // troubleSpot weight is 120 / 540 of the default template, applied to 600s.
    const expectedTroubleSec = Math.floor((120 / 540) * 600);
    expect(sumDur(troubleBlocks)).toBe(expectedTroubleSec);
  });

  it("each trouble block reads its own spot's BPM via tempoFn", () => {
    const song = makeSong([{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]);
    const troubleBlocks = buildBlocks(10, song).filter(
      (b) => b.kind === "troubleSpot",
    );
    expect(troubleBlocks[0].tempoFn(song)).toBe(150);
    expect(troubleBlocks[1].tempoFn(song)).toBe(160);
    expect(troubleBlocks[2].tempoFn(song)).toBe(170);
  });

  it("each trouble block promotes its own index", () => {
    const song = makeSong([{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }]);
    const troubleBlocks = buildBlocks(10, song).filter(
      (b) => b.kind === "troubleSpot",
    );
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

  it("20 min with 2 spots sums to exactly 1200 s", () => {
    const blocks = buildBlocks(20, makeSong([{ bpm: 150 }, { bpm: 160 }]));
    expect(sumDur(blocks)).toBe(1200);
  });

  it("30 min with 1 spot sums to exactly 1800 s", () => {
    const blocks = buildBlocks(30, makeSong([{ bpm: 150 }]));
    expect(sumDur(blocks)).toBe(1800);
  });

  it("5 min with 1 spot sums to exactly 300 s", () => {
    const blocks = buildBlocks(5, makeSong([{ bpm: 150 }]));
    expect(sumDur(blocks)).toBe(300);
  });
});

describe("buildBlocks — custom templates", () => {
  it("structure key changes when only a block duration changes", () => {
    const firstTemplate = cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE);
    const secondTemplate = cloneSongTemplate(DEFAULT_SONG_BLOCK_TEMPLATE);
    secondTemplate[0] = {
      ...secondTemplate[0],
      duration: { kind: "fixed", seconds: 120 },
    };

    expect(
      songBlockStructureKey(makeSong([], { blockTemplate: firstTemplate })),
    ).not.toBe(
      songBlockStructureKey(makeSong([], { blockTemplate: secondTemplate })),
    );
  });

  it("disabling a row drops it and redistributes time", () => {
    const template: SongBlockTemplate = cloneSongTemplate(
      DEFAULT_SONG_BLOCK_TEMPLATE,
    );
    const idx = template.findIndex((e) => e.role === "overspeed");
    template[idx].enabled = false;
    const blocks = buildBlocks(10, makeSong([{ bpm: 150 }], { blockTemplate: template }));
    expect(blocks.some((b) => b.kind === "overspeed")).toBe(false);
    expect(sumDur(blocks)).toBe(600);
  });

  it("reordering changes the body order in output", () => {
    const template: SongBlockTemplate = cloneSongTemplate(
      DEFAULT_SONG_BLOCK_TEMPLATE,
    );
    // Move consolidation to the front.
    const consIdx = template.findIndex((e) => e.role === "consolidation");
    const [consEntry] = template.splice(consIdx, 1);
    template.unshift(consEntry);
    const blocks = buildBlocks(10, makeSong([{ bpm: 150 }], { blockTemplate: template }));
    // First non-Conscious block is now consolidation.
    expect(blocks[1].kind).toBe("consolidation");
  });

  it("template with all rows disabled produces no body blocks", () => {
    const template: SongBlockTemplate = cloneSongTemplate(
      DEFAULT_SONG_BLOCK_TEMPLATE,
    ).map((e) => ({ ...e, enabled: false }));
    const blocks = buildBlocks(
      10,
      makeSong([{ bpm: 150 }], { blockTemplate: template, includeWarmupBlock: false }),
    );
    expect(blocks).toEqual([]);
  });

  it("custom weights split time proportionally", () => {
    const template: SongBlockTemplate = [
      {
        ...DEFAULT_SONG_BLOCK_TEMPLATE.find((e) => e.role === "slowReference")!,
        id: "slow",
        duration: { kind: "percent", percent: 100 },
      },
      {
        ...DEFAULT_SONG_BLOCK_TEMPLATE.find((e) => e.role === "ceilingWork")!,
        id: "ceiling",
        duration: { kind: "percent", percent: 200 },
      },
    ];
    const blocks = buildBlocks(
      5,
      makeSong([], { blockTemplate: template, includeWarmupBlock: false }),
    );
    expect(blocks).toHaveLength(2);
    expect(sumDur(blocks)).toBe(300);
    // 100/300 of 300s = 100s; 200/300 of 300s = 200s.
    expect(blocks[0].durationSec).toBe(100);
    expect(blocks[1].durationSec).toBe(200);
  });

  it("fixed blocks keep their flat duration while percent blocks divide the rest", () => {
    const template: SongBlockTemplate = [
      {
        ...DEFAULT_SONG_BLOCK_TEMPLATE.find((e) => e.role === "slowReference")!,
        id: "fixed",
        duration: { kind: "fixed", seconds: 120 },
      },
      {
        ...DEFAULT_SONG_BLOCK_TEMPLATE.find((e) => e.role === "ceilingWork")!,
        id: "percent",
        duration: { kind: "percent", percent: 100 },
      },
    ];
    const blocks = buildBlocks(
      10,
      makeSong([], { blockTemplate: template, includeWarmupBlock: false }),
    );
    expect(blocks.map((b) => b.durationSec)).toEqual([120, 480]);
  });
});

describe("buildBlocks — timed and open-ended song modes", () => {
  it("timed mode returns a single countdown block after optional warm-up", () => {
    const song = makeSong([], {
      practiceMode: "timed",
      includeWarmupBlock: false,
      metronomeEnabled: false,
      workingBpm: null,
    });
    const blocks = buildBlocks(12, song);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("timedPractice");
    expect(blocks[0].durationSec).toBe(720);
    expect(blocks[0].metronomeEnabled).toBe(false);
    expect(blocks[0].showEarnedButton).toBe(false);
  });

  it("openEnded mode returns one unbounded count-up block without warm-up", () => {
    const song = makeSong([], {
      practiceMode: "openEnded",
      metronomeEnabled: false,
      workingBpm: null,
    });
    const blocks = buildBlocks(10, song);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("openEnded");
    expect(blocks[0].unbounded).toBe(true);
    expect(blocks[0].metronomeEnabled).toBe(false);
  });
});

describe("buildBlocks — simple practice mode", () => {
  it("returns Conscious + a single Steady BPM block at workingBpm", () => {
    const song = makeSong([{ bpm: 150 }], { practiceMode: "simple" });
    const blocks = buildBlocks(10, song);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe("consciousPractice");
    expect(blocks[1].kind).toBe("simpleMetronome");
    expect(blocks[1].durationSec).toBe(600);
    expect(blocks[1].unbounded).not.toBe(true);
    expect(blocks[1].tempoFn(song)).toBe(song.workingBpm);
    expect(blocks[1].showEarnedButton).toBe(true);
    expect(blocks[1].promotes).toEqual({ kind: "working" });
  });

  it("ignores trouble spots and template in simple mode", () => {
    const song = makeSong(
      [{ bpm: 150 }, { bpm: 160 }, { bpm: 170 }],
      { practiceMode: "simple" },
    );
    const blocks = buildBlocks(10, song);
    expect(blocks.some((b) => b.kind === "troubleSpot")).toBe(false);
  });

  it("scales the Steady block to the chosen session length", () => {
    for (const minutes of [5, 10, 20, 30]) {
      const song = makeSong([], { practiceMode: "simple" });
      const blocks = buildBlocks(minutes, song);
      const steady = blocks.find((b) => b.kind === "simpleMetronome");
      expect(steady?.durationSec).toBe(minutes * 60);
    }
  });

  it("simple mode without warmup: just the Steady BPM block", () => {
    const song = makeSong([], {
      practiceMode: "simple",
      includeWarmupBlock: false,
    });
    const blocks = buildBlocks(10, song);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("simpleMetronome");
    expect(blocks[0].durationSec).toBe(600);
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
