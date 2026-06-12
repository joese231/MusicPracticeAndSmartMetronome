import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "@/types/exercise";
import { DEFAULT_SETTINGS } from "@/types/song";
import { POST, PUT } from "./route";

let written: unknown = null;

vi.mock("@/lib/db/fileStore", () => ({
  readJson: vi.fn(async (_file, fallback) => fallback),
  updateJsonAtomic: vi.fn(async (_file, fallback, mutator) => {
    const { value, result } = await mutator(
      Array.isArray(written) ? written : fallback,
    );
    written = value;
    return result;
  }),
  writeJsonAtomic: vi.fn(async (_file, value) => {
    written = value;
  }),
}));

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "exercise-1",
    name: "Forward roll",
    link: null,
    notes: null,
    workingBpm: 80,
    warmupBpm: null,
    stepPercent: 2.5,
    sessionMinutes: 5,
    openEnded: false,
    metronomeEnabled: true,
    practiceMode: "smart",
    includeWarmupBlock: true,
    blockTemplate: DEFAULT_SETTINGS.defaultExerciseBlockTemplate,
    totalPracticeSec: 0,
    sortIndex: 0,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("exercises API validation", () => {
  beforeEach(() => {
    written = null;
  });

  it("validates exercise creates", async () => {
    const res = await POST(
      new Request("http://test/api/exercises", {
        method: "POST",
        body: JSON.stringify(makeExercise()),
      }),
    );

    expect(res.status).toBe(200);
    expect(written).toEqual([makeExercise()]);
  });

  it("rejects malformed exercise creates", async () => {
    const res = await POST(
      new Request("http://test/api/exercises", {
        method: "POST",
        body: JSON.stringify(makeExercise({ workingBpm: 0 })),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "exercise.workingBpm must be a playable BPM",
    });
  });

  it("validates legacy bulk replacement rows", async () => {
    const res = await PUT(
      new Request("http://test/api/exercises", {
        method: "PUT",
        body: JSON.stringify([
          makeExercise(),
          makeExercise({ id: "exercise-2", workingBpm: 0 }),
        ]),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "exercise.workingBpm must be a playable BPM",
    });
  });
});
