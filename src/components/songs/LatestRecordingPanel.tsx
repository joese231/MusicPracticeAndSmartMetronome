"use client";
import { useCallback, useRef } from "react";
import { useSessionStore } from "@/lib/store/useSessionStore";
import { formatDuration } from "@/lib/format";

export function LatestRecordingPanel({ songId }: { songId: string }) {
  const recording = useSessionStore((s) => s.latestRecording);
  const clear = useSessionStore((s) => s.clearLatestRecording);
  const fixedRef = useRef(false);

  // MediaRecorder's webm/opus blobs have no duration metadata, so browsers
  // report duration as Infinity and the seek bar stays broken. Force the
  // browser to scan to EOF: seek past the end once, then back to 0.
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const el = e.currentTarget;
      if (fixedRef.current) return;
      if (el.duration === Infinity || Number.isNaN(el.duration)) {
        const onTimeUpdate = () => {
          el.removeEventListener("timeupdate", onTimeUpdate);
          el.currentTime = 0;
          fixedRef.current = true;
        };
        el.addEventListener("timeupdate", onTimeUpdate);
        el.currentTime = 1e9;
      } else {
        fixedRef.current = true;
      }
    },
    [],
  );

  if (!recording || recording.songId !== songId) return null;

  const modeLabel = `${recording.durationMinutes}-minute session`;

  return (
    <section className="rounded-lg border border-bg-border bg-bg-elevated p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Last session recording</h2>
        <button
          onClick={clear}
          className="text-sm text-neutral-400 transition hover:text-red-400"
        >
          Discard
        </button>
      </div>
      <div className="mt-1 text-sm text-neutral-400">
        {modeLabel} · {formatDuration(recording.durationSec)}
      </div>
      <audio
        key={recording.blobUrl}
        controls
        src={recording.blobUrl}
        onLoadedMetadata={handleLoadedMetadata}
        className="mt-4 w-full"
        preload="metadata"
      />
      <p className="mt-2 text-xs text-neutral-500">
        Recordings are in-memory only. Starting a new session or refreshing the page releases this recording.
      </p>
    </section>
  );
}
