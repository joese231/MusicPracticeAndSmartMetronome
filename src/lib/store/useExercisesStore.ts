import { create } from "zustand";
import type { Exercise } from "@/types/exercise";
import type { ExerciseBlockTemplate, PracticeMode } from "@/types/song";
import {
  cloneExerciseTemplate,
  DEFAULT_EXERCISE_BLOCK_TEMPLATE,
  DEFAULT_INCLUDE_WARMUP,
  DEFAULT_PRACTICE_MODE,
  DEFAULT_STEP_PERCENT,
} from "@/types/song";
import { getRepository } from "@/lib/db/localRepository";
import { nowIso } from "@/lib/session/tempo";
import { DEFAULT_EXERCISE_MINUTES } from "@/lib/session/exerciseBlocks";
import { useSettingsStore } from "./useSettingsStore";

type NewExerciseInput = {
  name: string;
  link: string | null;
  notes: string | null;
  workingBpm: number;
  stepPercent?: number;
  sessionMinutes?: number;
  openEnded?: boolean;
  metronomeEnabled?: boolean;
  practiceMode?: PracticeMode;
  includeWarmupBlock?: boolean;
  blockTemplate?: ExerciseBlockTemplate;
};

type ExercisesState = {
  exercises: Exercise[];
  loaded: boolean;
  load: () => Promise<void>;
  getById: (id: string) => Exercise | undefined;
  createExercise: (input: NewExerciseInput) => Promise<Exercise>;
  updateExercise: (exercise: Exercise) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  reorderExercises: (orderedIds: string[]) => Promise<void>;
  incrementPracticeTime: (id: string, seconds: number) => Promise<void>;
  /** Add a (possibly-negative) delta to totalPracticeSec, clamped at 0.
   * Used by the session-edit modal to roll back when a session is trimmed
   * or deleted. */
  adjustPracticeTime: (id: string, deltaSec: number) => Promise<void>;
};

const genId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

function isStaleWriteError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("409");
}

export const useExercisesStore = create<ExercisesState>((set, get) => ({
  exercises: [],
  loaded: false,

  load: async () => {
    const exercises = await getRepository().listExercises();
    set({ exercises, loaded: true });
  },

  getById: (id) => get().exercises.find((e) => e.id === id),

  createExercise: async (input) => {
    const now = nowIso();
    const existing = get().exercises;
    const nextSortIndex =
      existing.length === 0
        ? 0
        : Math.min(...existing.map((e) => e.sortIndex)) - 1;
    const globalSettings = useSettingsStore.getState().settings;
    const settingsDefault =
      globalSettings.defaultPracticeMode ?? DEFAULT_PRACTICE_MODE;
    const settingsTemplate =
      globalSettings.defaultExerciseBlockTemplate &&
      globalSettings.defaultExerciseBlockTemplate.length > 0
        ? cloneExerciseTemplate(globalSettings.defaultExerciseBlockTemplate)
        : cloneExerciseTemplate(DEFAULT_EXERCISE_BLOCK_TEMPLATE);
    const exercise: Exercise = {
      id: genId(),
      name: input.name.trim(),
      link: input.link?.trim() || null,
      notes: input.notes?.trim() || null,
      workingBpm: input.workingBpm,
      warmupBpm: null,
      stepPercent: input.stepPercent ?? DEFAULT_STEP_PERCENT,
      sessionMinutes:
        input.sessionMinutes ??
        globalSettings.defaultExerciseSessionMinutes ??
        DEFAULT_EXERCISE_MINUTES,
      openEnded:
        input.openEnded ?? (input.practiceMode ?? settingsDefault) === "openEnded",
      metronomeEnabled: input.metronomeEnabled ?? true,
      practiceMode: input.practiceMode ?? settingsDefault,
      includeWarmupBlock: input.includeWarmupBlock ?? DEFAULT_INCLUDE_WARMUP,
      blockTemplate: input.blockTemplate
        ? cloneExerciseTemplate(input.blockTemplate)
        : settingsTemplate,
      totalPracticeSec: 0,
      sortIndex: nextSortIndex,
      createdAt: now,
      updatedAt: now,
    };
    await getRepository().upsertExercise(exercise);
    set({ exercises: [exercise, ...existing] });
    return exercise;
  },

  updateExercise: async (exercise) => {
    const updated = { ...exercise, updatedAt: nowIso() };
    try {
      await getRepository().upsertExercise(updated);
      set({
        exercises: get().exercises.map((e) =>
          e.id === updated.id ? updated : e,
        ),
      });
    } catch (err) {
      if (isStaleWriteError(err)) await get().load();
      throw err;
    }
  },

  deleteExercise: async (id) => {
    await getRepository().deleteExercise(id);
    set({ exercises: get().exercises.filter((e) => e.id !== id) });
  },

  reorderExercises: async (orderedIds) => {
    const byId = new Map(get().exercises.map((e) => [e.id, e]));
    const next: Exercise[] = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const ex = byId.get(orderedIds[i]);
      if (ex) next.push({ ...ex, sortIndex: i });
    }
    set({ exercises: next });
    try {
      await getRepository().reorderExercises(orderedIds);
    } catch (err) {
      await get().load();
      throw err;
    }
  },

  incrementPracticeTime: async (id, seconds) => {
    const e = get().exercises.find((x) => x.id === id);
    if (!e) return;
    const total = await getRepository().adjustPracticeTime(
      "exercise",
      id,
      Math.round(seconds),
    );
    const updated: Exercise = {
      ...e,
      totalPracticeSec: total,
      updatedAt: nowIso(),
    };
    set({ exercises: get().exercises.map((x) => (x.id === id ? updated : x)) });
  },

  adjustPracticeTime: async (id, deltaSec) => {
    const e = get().exercises.find((x) => x.id === id);
    if (!e) return;
    const next = await getRepository().adjustPracticeTime(
      "exercise",
      id,
      deltaSec,
    );
    const updated: Exercise = {
      ...e,
      totalPracticeSec: next,
      updatedAt: nowIso(),
    };
    set({ exercises: get().exercises.map((x) => (x.id === id ? updated : x)) });
  },
}));
