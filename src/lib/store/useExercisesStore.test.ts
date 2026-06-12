import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "@/lib/db/repository";
import type { Exercise } from "@/types/exercise";
import { DEFAULT_SETTINGS } from "@/types/song";
import { useExercisesStore } from "./useExercisesStore";
import { useSettingsStore } from "./useSettingsStore";

const repo: Partial<Repository> = {};

vi.mock("@/lib/db/localRepository", () => ({
  getRepository: () => repo,
}));

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "exercise-1",
    name: "Local",
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

describe("useExercisesStore persistence recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(repo) as Array<keyof Repository>) {
      delete repo[key];
    }
    useExercisesStore.setState({ exercises: [], loaded: false });
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, loaded: true });
  });

  it("reloads exercises when an update hits optimistic concurrency", async () => {
    const serverExercise = makeExercise({ name: "Server" });
    repo.upsertExercise = vi.fn(async () => {
      throw new Error("PATCH /api/exercises/exercise-1 failed: 409");
    });
    repo.listExercises = vi.fn(async () => [serverExercise]);
    useExercisesStore.setState({ exercises: [makeExercise()], loaded: true });

    await expect(
      useExercisesStore
        .getState()
        .updateExercise(makeExercise({ name: "Edited" })),
    ).rejects.toThrow("409");

    expect(repo.listExercises).toHaveBeenCalled();
    expect(useExercisesStore.getState().exercises).toEqual([serverExercise]);
  });

  it("creates new exercises at the top of the manual order", async () => {
    repo.upsertExercise = vi.fn(async () => {});
    useExercisesStore.setState({
      exercises: [
        makeExercise({ id: "exercise-1", sortIndex: 0, name: "First" }),
        makeExercise({ id: "exercise-2", sortIndex: 1, name: "Second" }),
      ],
      loaded: true,
    });

    const created = await useExercisesStore.getState().createExercise({
      name: "Newest",
      link: null,
      notes: null,
      workingBpm: 120,
    });

    expect(created.sortIndex).toBe(-1);
    expect(repo.upsertExercise).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id, sortIndex: -1 }),
    );
    expect(useExercisesStore.getState().exercises.map((e) => e.id)).toEqual([
      created.id,
      "exercise-1",
      "exercise-2",
    ]);
  });
});
