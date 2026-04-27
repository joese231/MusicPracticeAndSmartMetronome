import { describe, it, expect } from "vitest";
import {
  buildExerciseBlocks,
  buildExerciseTimedBlocks,
  DEFAULT_EXERCISE_MINUTES,
  MAX_EXERCISE_MINUTES,
  MIN_EXERCISE_MINUTES,
} from "./exerciseBlocks";
import { exerciseAsSong } from "./exerciseAdapter";
import type { Exercise } from "@/types/exercise";

const makeExercise = (
  workingBpm = 100,
  sessionMinutes = 5,
  overrides: Partial<Exercise> = {},
): Exercise => ({
  id: "e1",
  name: "Crosspicking — pattern 3",
  link: null,
  notes: null,
  workingBpm,
  warmupBpm: null,
  stepPercent: 2.5,
  sessionMinutes,
  openEnded: false,
  metronomeEnabled: true,
  practiceMode: "smart",
  includeWarmupBlock: true,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("buildExerciseTimedBlocks", () => {
  it("default 5 min: Build 180s, Burst 90s, Cool Down 30s — totals 300s", () => {
    const b = buildExerciseTimedBlocks(5);
    expect(b).toHaveLength(3);
    expect(b[0].label).toBe("Build");
    expect(b[0].durationSec).toBe(180);
    expect(b[1].label).toBe("Burst");
    expect(b[1].durationSec).toBe(90);
    expect(b[2].label).toBe("Cool Down");
    expect(b[2].durationSec).toBe(30);
    expect(b.reduce((a, x) => a + x.durationSec, 0)).toBe(300);
  });

  it.each([
    [5, 180],
    [10, 480],
    [20, 1080],
    [30, 1680],
    [60, 3480],
  ])(
    "%i min total → Build %i s, Burst always 90, Cool Down always 30",
    (minutes, buildSec) => {
      const b = buildExerciseTimedBlocks(minutes);
      expect(b[0].durationSec).toBe(buildSec);
      expect(b[1].durationSec).toBe(90);
      expect(b[2].durationSec).toBe(30);
      expect(b.reduce((a, x) => a + x.durationSec, 0)).toBe(minutes * 60);
    },
  );

  it("clamps below the floor up to MIN_EXERCISE_MINUTES", () => {
    const b = buildExerciseTimedBlocks(1);
    expect(b.reduce((a, x) => a + x.durationSec, 0)).toBe(
      MIN_EXERCISE_MINUTES * 60,
    );
  });

  it("clamps above the ceiling down to MAX_EXERCISE_MINUTES", () => {
    const b = buildExerciseTimedBlocks(999);
    expect(b.reduce((a, x) => a + x.durationSec, 0)).toBe(
      MAX_EXERCISE_MINUTES * 60,
    );
  });

  it("only the Build block has the earn button", () => {
    const b = buildExerciseTimedBlocks(10);
    expect(b[0].showEarnedButton).toBe(true);
    expect(b[0].promotes).toEqual({ kind: "working" });
    expect(b[1].showEarnedButton).toBe(false);
    expect(b[1].promotes).toBeNull();
    expect(b[2].showEarnedButton).toBe(false);
    expect(b[2].promotes).toBeNull();
  });

  it("computes block tempos from working BPM (100) regardless of length", () => {
    const song = exerciseAsSong(makeExercise(100, 30));
    const b = buildExerciseTimedBlocks(30);
    expect(b[0].tempoFn(song)).toBe(100); // Build = working
    expect(b[1].tempoFn(song)).toBe(106); // Burst = step(step(100)) = 106
    expect(b[2].tempoFn(song)).toBe(77); // Cool Down = round(100 * 0.77)
  });

  it("Cool Down ends below working tempo for any working BPM", () => {
    const b = buildExerciseTimedBlocks(10);
    for (const bpm of [60, 100, 150, 200, 280]) {
      const song = exerciseAsSong(makeExercise(bpm));
      expect(b[2].tempoFn(song)).toBeLessThan(bpm);
    }
  });
});

describe("buildExerciseBlocks", () => {
  it("prepends an unbounded Conscious Practice warm-up", () => {
    const blocks = buildExerciseBlocks(makeExercise(100, DEFAULT_EXERCISE_MINUTES));
    expect(blocks[0].kind).toBe("consciousPractice");
    expect(blocks[0].unbounded).toBe(true);
  });

  it("produces 4 blocks total (warm-up + 3 timed)", () => {
    expect(buildExerciseBlocks(makeExercise(100, 5))).toHaveLength(4);
    expect(buildExerciseBlocks(makeExercise(100, 20))).toHaveLength(4);
  });

  it("warm-up tempo defaults to ⅓ of working BPM (floored at 20)", () => {
    const blocks = buildExerciseBlocks(makeExercise(120));
    expect(blocks[0].tempoFn(exerciseAsSong(makeExercise(120)))).toBe(40);
    expect(blocks[0].tempoFn(exerciseAsSong(makeExercise(30)))).toBe(20);
  });

  describe("simple practice mode", () => {
    it("produces Conscious + a single Steady BPM block for sessionMinutes", () => {
      const ex = makeExercise(120, 10, { practiceMode: "simple" });
      const blocks = buildExerciseBlocks(ex);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].kind).toBe("consciousPractice");
      expect(blocks[1].kind).toBe("simpleMetronome");
      expect(blocks[1].durationSec).toBe(600);
      expect(blocks[1].showEarnedButton).toBe(false);
      expect(blocks[1].promotes).toBeNull();
    });

    it("Steady block plays at workingBpm", () => {
      const ex = makeExercise(140, 5, { practiceMode: "simple" });
      const blocks = buildExerciseBlocks(ex);
      const steady = blocks.find((b) => b.kind === "simpleMetronome");
      expect(steady?.tempoFn(exerciseAsSong(ex))).toBe(140);
    });
  });

  describe("includeWarmupBlock = false", () => {
    it("smart mode: drops the Conscious Practice prefix", () => {
      const blocks = buildExerciseBlocks(
        makeExercise(100, 10, { includeWarmupBlock: false }),
      );
      expect(blocks.some((b) => b.kind === "consciousPractice")).toBe(false);
      expect(blocks).toHaveLength(3); // Build + Burst + Cool Down
    });

    it("simple mode: only the Steady BPM block", () => {
      const blocks = buildExerciseBlocks(
        makeExercise(100, 10, {
          practiceMode: "simple",
          includeWarmupBlock: false,
        }),
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe("simpleMetronome");
    });

    it("openEnded ignores includeWarmupBlock — still exactly the open-ended block", () => {
      const blocks = buildExerciseBlocks(
        makeExercise(100, 10, {
          openEnded: true,
          includeWarmupBlock: false,
        }),
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe("openEnded");
    });
  });

  describe("openEnded exercises", () => {
    it("returns a single open-ended block (no warm-up, no Build/Burst/Cool Down)", () => {
      const blocks = buildExerciseBlocks(makeExercise(120, 5, { openEnded: true }));
      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe("openEnded");
      expect(blocks[0].unbounded).toBe(true);
    });

    it("the open-ended block plays at workingBpm", () => {
      const ex = makeExercise(140, 5, { openEnded: true });
      const blocks = buildExerciseBlocks(ex);
      expect(blocks[0].tempoFn(exerciseAsSong(ex))).toBe(140);
    });

    it("does not show the earn button or promote", () => {
      const blocks = buildExerciseBlocks(makeExercise(100, 5, { openEnded: true }));
      expect(blocks[0].showEarnedButton).toBe(false);
      expect(blocks[0].promotes).toBeNull();
    });

    it("ignores sessionMinutes when openEnded is true", () => {
      const blocks5 = buildExerciseBlocks(
        makeExercise(100, 5, { openEnded: true }),
      );
      const blocks30 = buildExerciseBlocks(
        makeExercise(100, 30, { openEnded: true }),
      );
      expect(blocks5).toEqual(blocks30);
    });
  });
});
