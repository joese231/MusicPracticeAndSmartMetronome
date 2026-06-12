"use client";
import { useState, type DragEvent } from "react";
import Link from "next/link";
import type { Exercise } from "@/types/exercise";
import { formatPracticeTime } from "@/lib/format";
import { useExercisesStore } from "@/lib/store/useExercisesStore";

export function moveExerciseIds(
  ids: string[],
  from: number,
  to: number,
): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) {
    return ids;
  }
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function ExerciseList({
  exercises,
  lastPlayedId,
}: {
  exercises: Exercise[];
  lastPlayedId?: string | null;
}) {
  const reorderExercises = useExercisesStore((s) => s.reorderExercises);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (e: DragEvent<HTMLLIElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, overIdArg: string) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== overIdArg) setOverId(overIdArg);
  };

  const handleDragLeave = () => {};

  const handleDrop = async (e: DragEvent<HTMLLIElement>, dropId: string) => {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (!sourceId || sourceId === dropId) return;

    const ids = exercises.map((x) => x.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(dropId);
    if (from < 0 || to < 0) return;
    const next = moveExerciseIds(ids, from, to);
    await reorderExercises(next);
  };

  const moveExercise = async (from: number, to: number) => {
    const ids = exercises.map((x) => x.id);
    const next = moveExerciseIds(ids, from, to);
    if (next === ids) return;
    await reorderExercises(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <ul className="space-y-3">
      {exercises.map((ex, index) => {
        const isDragging = draggingId === ex.id;
        const isOver = overId === ex.id && draggingId && draggingId !== ex.id;
        const isLastPlayed =
          !!lastPlayedId && ex.id === lastPlayedId && !isOver && !isDragging;
        return (
          <li
            key={ex.id}
            draggable
            onDragStart={(e) => handleDragStart(e, ex.id)}
            onDragOver={(e) => handleDragOver(e, ex.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, ex.id)}
            onDragEnd={handleDragEnd}
            className={`group relative rounded-lg border bg-bg-elevated transition ${
              isOver
                ? "border-accent ring-2 ring-accent/40"
                : isLastPlayed
                  ? "border-accent/40 ring-1 ring-accent/40 hover:border-accent/60 hover:bg-bg-elevated/80"
                  : "border-bg-border hover:border-accent/60 hover:bg-bg-elevated/80"
            } ${isDragging ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-3 px-3 py-4">
              <div className="flex flex-none flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Move ${ex.name} up`}
                  disabled={index === 0}
                  onClick={() => void moveExercise(index, index - 1)}
                  className="rounded border border-bg-border px-2 py-1 text-xs font-semibold text-neutral-300 transition hover:border-accent/60 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-bg-border disabled:hover:bg-transparent"
                >
                  Up
                </button>
                <button
                  type="button"
                  aria-label={`Move ${ex.name} down`}
                  disabled={index === exercises.length - 1}
                  onClick={() => void moveExercise(index, index + 1)}
                  className="rounded border border-bg-border px-2 py-1 text-xs font-semibold text-neutral-300 transition hover:border-accent/60 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-bg-border disabled:hover:bg-transparent"
                >
                  Down
                </button>
              </div>
              <span
                className="flex-none cursor-grab select-none px-2 text-2xl leading-none text-neutral-500 transition hover:text-neutral-200 active:cursor-grabbing"
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                ⋮⋮
              </span>
              <Link
                href={`/exercises/${ex.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
                draggable={false}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-semibold text-neutral-100">
                    {ex.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
                    <span>
                      Working{" "}
                      <span className="text-neutral-200">{ex.workingBpm}</span> BPM
                    </span>
                    <span>
                      Total{" "}
                      <span className="text-neutral-200">
                        {formatPracticeTime(ex.totalPracticeSec)}
                      </span>
                    </span>
                  </div>
                </div>
                <span className="text-2xl text-neutral-500" aria-hidden>
                  ›
                </span>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
