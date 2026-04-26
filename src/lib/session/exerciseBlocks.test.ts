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

const makeExercise = (workingBpm = 100, sessionMinutes = 5): Exercise => ({
  id: "e1",
  name: "Crosspicking — pattern 3",
  link: null,
  notes: null,
  workingBpm,
  warmupBpm: null,
  stepPercent: 2.5,
  sessionMinutes,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "",
  updatedAt: "",
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
    const blocks = buildExerciseBlocks(DEFAULT_EXERCISE_MINUTES);
    expect(blocks[0].kind).toBe("consciousPractice");
    expect(blocks[0].unbounded).toBe(true);
  });

  it("produces 4 blocks total (warm-up + 3 timed)", () => {
    expect(buildExerciseBlocks(5)).toHaveLength(4);
    expect(buildExerciseBlocks(20)).toHaveLength(4);
  });

  it("warm-up tempo defaults to ⅓ of working BPM (floored at 20)", () => {
    const blocks = buildExerciseBlocks(5);
    expect(blocks[0].tempoFn(exerciseAsSong(makeExercise(120)))).toBe(40);
    expect(blocks[0].tempoFn(exerciseAsSong(makeExercise(30)))).toBe(20);
  });
});
