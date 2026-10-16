"use client";
import { useState, type DragEvent } from "react";
import Link from "next/link";
import { unlockSharedAudioContext } from "@/lib/metronome/scheduler";
import type { Song } from "@/types/song";
import { formatPracticeTime } from "@/lib/format";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { bpmLabel } from "./SongCard";

export { bpmLabel };

export function moveSongIds(ids: string[], from: number, to: number): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) {
    return ids;
  }
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function SongList({
  songs,
  lastPlayedId,
}: {
  songs: Song[];
  lastPlayedId?: string | null;
}) {
  const reorderSongs = useSongsStore((s) => s.reorderSongs);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (e: DragEvent<HTMLLIElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Some browsers refuse to start a drag without data set.
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, overIdArg: string) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== overIdArg) setOverId(overIdArg);
  };

  const handleDragLeave = () => {
    // Intentionally do not null out overId here — dragleave fires when
    // crossing nested elements too, which would flicker the indicator.
  };

  const handleDrop = async (e: DragEvent<HTMLLIElement>, dropId: string) => {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (!sourceId || sourceId === dropId) return;

    const ids = songs.map((s) => s.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(dropId);
    if (from < 0 || to < 0) return;
    const next = moveSongIds(ids, from, to);
    await reorderSongs(next);
  };

  const moveSong = async (from: number, to: number) => {
    const ids = songs.map((s) => s.id);
    const next = moveSongIds(ids, from, to);
    if (next === ids) return;
    await reorderSongs(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <ul className="space-y-3">
      {songs.map((song, index) => {
        const isDragging = draggingId === song.id;
        const isOver = overId === song.id && draggingId && draggingId !== song.id;
        const isLastPlayed =
          !!lastPlayedId && song.id === lastPlayedId && !isOver && !isDragging;
        return (
          <li
            key={song.id}
            draggable
            onDragStart={(e) => handleDragStart(e, song.id)}
            onDragOver={(e) => handleDragOver(e, song.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, song.id)}
            onDragEnd={handleDragEnd}
            className={`group relative rounded-lg border bg-bg-elevated transition ${
              isOver
                ? "border-accent ring-2 ring-accent/40"
                : isLastPlayed
                  ? "border-accent/40 ring-1 ring-accent/40 hover:border-accent/60 hover:bg-bg-elevated/80"
                  : "border-bg-border hover:border-accent/60 hover:bg-bg-elevated/80"
            } ${isDragging ? "opacity-40" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="flex flex-none flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Move ${song.title} up`}
                  disabled={index === 0}
                  onClick={() => void moveSong(index, index - 1)}
                  className="rounded border border-bg-border px-2 py-1 text-xs font-semibold text-neutral-300 transition hover:border-accent/60 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-bg-border disabled:hover:bg-transparent"
                >
                  Up
                </button>
                <button
                  type="button"
                  aria-label={`Move ${song.title} down`}
                  disabled={index === songs.length - 1}
                  onClick={() => void moveSong(index, index + 1)}
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
                href={`/session/${song.id}`}
                onClick={() => unlockSharedAudioContext()}
                className="flex min-w-[8rem] flex-1 items-center justify-between gap-4"
                draggable={false}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-3">
                    <h3 className="min-w-0 flex-1 truncate text-xl font-semibold text-neutral-100">
                      {song.title}
                    </h3>
                    <span className="shrink-0 whitespace-nowrap text-base font-semibold text-accent" title="Session length">
                      {song.practiceMode === "openEnded" ? "Open ended" : `${song.defaultSessionMinutes} min`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-400">
                    <span>
                      Working <span className="text-neutral-200">{bpmLabel(song)}</span>
                    </span>
                    {song.troubleSpots.length > 0 && (
                      <span>
                        Spots{" "}
                        <span className="text-neutral-200">
                          {song.troubleSpots.length}
                        </span>
                      </span>
                    )}
                    {song.originalBpm != null && (
                      <span>
                        Orig{" "}
                        <span className="text-neutral-200">{song.originalBpm}</span>{" "}
                        BPM
                      </span>
                    )}
                    <span>
                      Total{" "}
                      <span className="text-neutral-200">
                        {formatPracticeTime(song.totalPracticeSec)}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
              <div className="ml-auto flex flex-wrap gap-2">
                <Link href={`/songs/${song.id}?view=statistics`} aria-label={`Statistics for ${song.title}`} className="rounded-lg border border-bg-border px-3 py-2 text-sm font-semibold text-neutral-200 hover:border-accent hover:bg-bg" draggable={false}>Statistics</Link>
                <Link href={`/songs/${song.id}?edit=1`} aria-label={`Edit ${song.title}`} className="rounded-lg border border-bg-border px-3 py-2 text-sm text-accent hover:bg-bg" draggable={false}>Edit</Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
