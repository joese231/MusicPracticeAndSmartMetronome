import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "@/types/exercise";
import { DEFAULT_SETTINGS } from "@/types/song";
import { PATCH } from "./route";

let exercises: Exercise[] = [];

vi.mock("@/lib/db/fileStore", () => ({
  updateJsonAtomic: vi.fn(async (_file, fallback, mutator) => {
    const { value, result } = await mutator(
      exercises.length ? exercises : fallback,
    );
    exercises = value;
    return result;
  }),
}));

const makeExercise = (id: string, sortIndex: number, name: string): Exercise => ({
  id,
  name,
  link: null,
  notes: null,
  workingBpm: 80,
  warmupBpm: null,
  stepPercent: 2.5,
  sessionMinutes: 5,
  openEnded: false,
  metronomeEnabled: true,
  practiceMode: "timed",
  includeWarmupBlock: true,
  blockTemplate: DEFAULT_SETTINGS.defaultExerciseBlockTemplate,
  totalPracticeSec: id === "exercise-1" ? 300 : 0,
  sortIndex,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
});

describe("exercise reorder API", () => {
  beforeEach(() => {
    exercises = [
      makeExercise("exercise-1", 0, "A"),
      makeExercise("exercise-2", 1, "B"),
    ];
  });

  it("updates only sortIndex and preserves every other field", async () => {
    const res = await PATCH(
      new Request("http://test/api/exercises/reorder", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds: ["exercise-2", "exercise-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(exercises).toEqual([
      expect.objectContaining({
        id: "exercise-1",
        sortIndex: 1,
        totalPracticeSec: 300,
      }),
      expect.objectContaining({
        id: "exercise-2",
        sortIndex: 0,
        totalPracticeSec: 0,
      }),
    ]);
  });
});
