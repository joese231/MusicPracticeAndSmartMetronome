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
    totalPracticeSec: 300,
    sortIndex: 0,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("exercise item API", () => {
  beforeEach(() => {
    exercises = [makeExercise()];
  });

  it("rejects patches that try to overwrite practice totals", async () => {
    const res = await PATCH(
      new Request("http://test/api/exercises/exercise-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
          patch: {
            name: "New name",
            totalPracticeSec: 0,
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: Promise.resolve({ id: "exercise-1" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "exercise patch field totalPracticeSec is not editable here",
    });
  });

  it("rejects patches that try to overwrite manual order", async () => {
    const res = await PATCH(
      new Request("http://test/api/exercises/exercise-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
          patch: {
            sortIndex: 99,
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: Promise.resolve({ id: "exercise-1" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "exercise patch field sortIndex is not editable here",
    });
    expect(exercises[0].sortIndex).toBe(0);
  });

  it("rejects stale patches when updatedAt changed", async () => {
    const res = await PATCH(
      new Request("http://test/api/exercises/exercise-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-11T23:59:00.000Z",
          patch: {
            name: "Stale name",
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: Promise.resolve({ id: "exercise-1" }) },
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "exercise was modified by another write",
    });
  });

  it("updates editable fields without changing practice totals", async () => {
    const res = await PATCH(
      new Request("http://test/api/exercises/exercise-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
          patch: {
            name: "Edited",
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: Promise.resolve({ id: "exercise-1" }) },
    );

    expect(res.status).toBe(200);
    expect(exercises[0]).toMatchObject({
      id: "exercise-1",
      name: "Edited",
      totalPracticeSec: 300,
    });
  });
});
