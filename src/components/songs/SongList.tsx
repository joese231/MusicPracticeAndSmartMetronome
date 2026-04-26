"use client";
import { useState, type DragEvent } from "react";
import Link from "next/link";
import type { Song } from "@/types/song";
import { formatPracticeTime } from "@/lib/format";
import { useSongsStore } from "@/lib/store/useSongsStore";

export function SongList({ songs }: { songs: Song[] }) {
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
    const next = ids.slice();
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    await reorderSongs(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <ul className="space-y-3">
      {songs.map((song) => {
        const isDragging = draggingId === song.id;
        const isOver = overId === song.id && draggingId && draggingId !== song.id;
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
                : "border-bg-border hover:border-accent/60 hover:bg-bg-elevated/80"
            } ${isDragging ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-3 px-3 py-4">
              <span
                className="flex-none cursor-grab select-none px-2 text-2xl leading-none text-neutral-500 transition hover:text-neutral-200 active:cursor-grabbing"
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                ⋮⋮
              </span>
              <Link
                href={`/songs/${song.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
                draggable={false}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-semibold text-neutral-100">
                    {song.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
                    <span>
                      Working{" "}
                      <span className="text-neutral-200">{song.workingBpm}</span> BPM
                    </span>
                    {song.troubleSpots.length > 0 && (
                      <span>
                        Trouble spots{" "}
                        <span className="text-neutral-200">
                          {song.troubleSpots.length}
                        </span>
                      </span>
                    )}
                    {song.originalBpm != null && (
                      <span>
                        Original{" "}
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
