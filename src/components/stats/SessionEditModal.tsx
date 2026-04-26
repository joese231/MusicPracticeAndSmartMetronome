"use client";
import { useEffect, useRef, useState } from "react";
import type { SessionRecord } from "@/types/sessionRecord";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useExercisesStore } from "@/lib/store/useExercisesStore";

type Props = {
  record: SessionRecord | null;
  onClose: () => void;
};

/**
 * Edit a session record's duration (trim only) or delete it. On both paths
 * the corresponding song/exercise's totalPracticeSec is rolled back by the
 * delta. For sessions whose item no longer exists (or for synthetic items
 * like Free Play), the rollback step is silently skipped.
 */
export function SessionEditModal({ record, onClose }: Props) {
  const updateSession = useSessionHistoryStore((s) => s.update);
  const removeSession = useSessionHistoryStore((s) => s.remove);
  const adjustSongTime = useSongsStore((s) => s.adjustPracticeTime);
  const adjustExerciseTime = useExercisesStore((s) => s.adjustPracticeTime);
  const songs = useSongsStore((s) => s.songs);
  const exercises = useExercisesStore((s) => s.exercises);

  const [minutes, setMinutes] = useState("0");
  const [seconds, setSeconds] = useState("0");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!record) return;
    const total = Math.max(0, Math.round(record.durationSec));
    setMinutes(String(Math.floor(total / 60)));
    setSeconds(String(total % 60));
    setConfirmDelete(false);
    setError(null);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [record]);

  if (!record) return null;

  const itemExists =
    record.itemKind === "song"
      ? songs.some((s) => s.id === record.itemId)
      : exercises.some((e) => e.id === record.itemId);

  const dt = new Date(record.startedAt);
  const dateStr = dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = dt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSave = async () => {
    setError(null);
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    if (
      !Number.isFinite(m) ||
      !Number.isFinite(s) ||
      m < 0 ||
      s < 0 ||
      s >= 60
    ) {
      setError("Enter a valid duration. Seconds must be 0–59.");
      return;
    }
    const newDur = m * 60 + s;
    if (newDur > record.durationSec) {
      setError("You can only trim — not extend — a session.");
      return;
    }
    if (newDur === record.durationSec) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const delta = newDur - record.durationSec;
      await updateSession(record.id, { durationSec: newDur });
      if (itemExists) {
        if (record.itemKind === "song") {
          await adjustSongTime(record.itemId, delta);
        } else {
          await adjustExerciseTime(record.itemId, delta);
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await removeSession(record.id);
      if (itemExists) {
        const delta = -record.durationSec;
        if (record.itemKind === "song") {
          await adjustSongTime(record.itemId, delta);
        } else {
          await adjustExerciseTime(record.itemId, delta);
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[min(95vw,28rem)] rounded-2xl border border-bg-border bg-bg-elevated p-6 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="text-sm font-semibold uppercase tracking-wider text-accent">
          Edit session
        </div>
        <div className="mt-2 truncate text-base font-medium text-neutral-100">
          {record.itemTitle}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {dateStr} · {timeStr}
        </div>

        <div className="mt-5">
          <label className="block text-xs uppercase tracking-wider text-neutral-500">
            Duration
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-20 rounded-lg border border-bg-border bg-bg px-3 py-2 text-center font-mono text-2xl font-bold tabular-nums text-neutral-100 focus:border-accent focus:outline-none"
            />
            <span className="text-sm text-neutral-500">min</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="w-20 rounded-lg border border-bg-border bg-bg px-3 py-2 text-center font-mono text-2xl font-bold tabular-nums text-neutral-100 focus:border-accent focus:outline-none"
            />
            <span className="text-sm text-neutral-500">sec</span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Trim only — you can&apos;t extend a session beyond what was recorded.
            Original: {Math.floor(record.durationSec / 60)}:
            {String(record.durationSec % 60).padStart(2, "0")}.
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mr-auto rounded-lg border border-bg-border px-4 py-2 text-sm text-neutral-400 transition hover:border-red-900 hover:text-red-300"
              disabled={busy}
            >
              Delete session
            </button>
          ) : (
            <div className="mr-auto flex items-center gap-2 rounded border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              <span>Delete this session?</span>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="rounded bg-red-700 px-2 py-1 font-semibold text-white hover:bg-red-600"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-bg-border px-4 py-2 text-sm text-neutral-300 hover:bg-bg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-black hover:bg-accent-strong disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
