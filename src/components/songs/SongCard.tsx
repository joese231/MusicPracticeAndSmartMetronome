"use client";
import Link from "next/link";
import type { Song } from "@/types/song";
import { formatPracticeTime } from "@/lib/format";

export function SongCard({ song }: { song: Song }) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="block rounded-lg border border-bg-border bg-bg-elevated px-5 py-4 transition hover:border-accent/60 hover:bg-bg-elevated/80"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold text-neutral-100">{song.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
            <span>
              Working <span className="text-neutral-200">{song.workingBpm}</span> BPM
            </span>
            {song.troubleSpots.length > 0 && (
              <span>
                Trouble spots <span className="text-neutral-200">{song.troubleSpots.length}</span>
              </span>
            )}
            {song.originalBpm != null && (
              <span>
                Original <span className="text-neutral-200">{song.originalBpm}</span> BPM
              </span>
            )}
            <span>
              Total <span className="text-neutral-200">{formatPracticeTime(song.totalPracticeSec)}</span>
            </span>
          </div>
        </div>
        <span className="text-2xl text-neutral-500" aria-hidden>›</span>
      </div>
    </Link>
  );
}
