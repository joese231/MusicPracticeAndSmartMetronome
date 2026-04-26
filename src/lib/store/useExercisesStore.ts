import { create } from "zustand";
import type { Exercise } from "@/types/exercise";
import { DEFAULT_STEP_PERCENT } from "@/types/song";
import { getRepository } from "@/lib/db/localRepository";
import { nowIso } from "@/lib/session/tempo";
import { DEFAULT_EXERCISE_MINUTES } from "@/lib/session/exerciseBlocks";

type NewExerciseInput = {
  name: string;
  link: string | null;
  notes: string | null;
  workingBpm: number;
  stepPercent?: number;
  sessionMinutes?: number;
  openEnded?: boolean;
  metronomeEnabled?: boolean;
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
        : Math.max(...existing.map((e) => e.sortIndex)) + 1;
    const exercise: Exercise = {
      id: genId(),
      name: input.name.trim(),
      link: input.link?.trim() || null,
      notes: input.notes?.trim() || null,
      workingBpm: input.workingBpm,
      warmupBpm: null,
      stepPercent: input.stepPercent ?? DEFAULT_STEP_PERCENT,
      sessionMinutes: input.sessionMinutes ?? DEFAULT_EXERCISE_MINUTES,
      openEnded: input.openEnded ?? false,
      metronomeEnabled: input.metronomeEnabled ?? true,
      totalPracticeSec: 0,
      sortIndex: nextSortIndex,
      createdAt: now,
      updatedAt: now,
    };
    await getRepository().upsertExercise(exercise);
    set({ exercises: [...existing, exercise] });
    return exercise;
  },

  updateExercise: async (exercise) => {
    const updated = { ...exercise, updatedAt: nowIso() };
    await getRepository().upsertExercise(updated);
    set({
      exercises: get().exercises.map((e) =>
        e.id === updated.id ? updated : e,
      ),
    });
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
    await getRepository().reorderExercises(orderedIds);
  },

  incrementPracticeTime: async (id, seconds) => {
    const e = get().exercises.find((x) => x.id === id);
    if (!e) return;
    const updated: Exercise = {
      ...e,
      totalPracticeSec: e.totalPracticeSec + Math.round(seconds),
      updatedAt: nowIso(),
    };
    await getRepository().upsertExercise(updated);
    set({ exercises: get().exercises.map((x) => (x.id === id ? updated : x)) });
  },

  adjustPracticeTime: async (id, deltaSec) => {
    const e = get().exercises.find((x) => x.id === id);
    if (!e) return;
    const next = Math.max(0, e.totalPracticeSec + Math.round(deltaSec));
    const updated: Exercise = {
      ...e,
      totalPracticeSec: next,
      updatedAt: nowIso(),
    };
    await getRepository().upsertExercise(updated);
    set({ exercises: get().exercises.map((x) => (x.id === id ? updated : x)) });
  },
}));
