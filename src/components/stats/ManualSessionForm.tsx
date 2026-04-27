"use client";

import { useState } from "react";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import { parseDurationToSeconds, createManualSessionRecord } from "@/lib/session/manualSessionUtils";

export function ManualSessionForm() {
  const songs = useSongsStore((s) => s.songs);
  const exercises = useExercisesStore((s) => s.exercises);
  const append = useSessionHistoryStore((s) => s.append);

  // Form state
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [time, setTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  );
  const [duration, setDuration] = useState<string>("25m");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedItemKind, setSelectedItemKind] = useState<"song" | "exercise">(
    "exercise"
  );
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [startBpm, setStartBpm] = useState<string>("");
  const [endBpm, setEndBpm] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  // Get the selected item (if any)
  const selectedItem =
    selectedItemKind === "song"
      ? songs.find((s) => s.id === selectedItemId)
      : exercises.find((e) => e.id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    try {
      // Validate
      if (!date || !time) {
        throw new Error("Date and time are required");
      }

      // Parse duration
      let durationSec: number;
      try {
        durationSec = parseDurationToSeconds(duration);
      } catch (err) {
        throw new Error(
          `Invalid duration: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      if (durationSec <= 0) {
        throw new Error("Duration must be greater than 0");
      }

      // Combine date and time
      const startedAt = new Date(`${date}T${time}`).toISOString();
      const now = new Date();
      if (new Date(startedAt) > now) {
        throw new Error("Session cannot be in the future");
      }

      // Create the session record
      let params: Parameters<typeof createManualSessionRecord>[0];

      if (selectedItem) {
        if (selectedItemKind === "exercise") {
          const exerciseItem = selectedItem as any;
          params = {
            exerciseId: exerciseItem.id,
            exerciseTitle: exerciseItem.name,
            startedAt,
            durationSec,
            ...(startBpm && { startWorkingBpm: parseInt(startBpm, 10) }),
            ...(endBpm && { endWorkingBpm: parseInt(endBpm, 10) }),
          };
        } else {
          const songItem = selectedItem as any;
          params = {
            songId: songItem.id,
            songTitle: songItem.title,
            startedAt,
            durationSec,
            ...(startBpm && { startWorkingBpm: parseInt(startBpm, 10) }),
            ...(endBpm && { endWorkingBpm: parseInt(endBpm, 10) }),
          };
        }
      } else {
        // Free-form session
        if (!sessionTitle.trim()) {
          throw new Error("Session title is required for free-form logging");
        }
        params = {
          startedAt,
          durationSec,
          sessionTitle: sessionTitle.trim(),
        };
      }

      const record = createManualSessionRecord(params);
      await append(record);

      // Success feedback
      setSuccess(true);
      setDate(new Date().toISOString().split("T")[0]);
      setTime(new Date().toTimeString().slice(0, 5));
      setDuration("25m");
      setSelectedItemId("");
      setSessionTitle("");
      setStartBpm("");
      setEndBpm("");
      setShowAdvanced(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mb-8 rounded-lg border border-neutral-700 bg-neutral-900 p-6">
      <h2 className="mb-6 text-xl font-bold">Log Manual Session</h2>

      {error && (
        <div className="mb-4 rounded bg-red-900 p-3 text-red-100">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded bg-green-900 p-3 text-green-100">
          Session logged successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100"
          />
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Duration (e.g., "25m", "25m 30s", or "1500s")
          </label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100"
            placeholder="25m"
          />
        </div>

        {/* Exercise/Song Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Exercise or Song (optional)
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={selectedItemKind}
              onChange={(e) => {
                setSelectedItemKind(e.target.value as "song" | "exercise");
                setSelectedItemId("");
              }}
              className="rounded bg-neutral-800 px-3 py-2 text-neutral-100"
            >
              <option value="exercise">Exercise</option>
              <option value="song">Song</option>
            </select>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="flex-1 rounded bg-neutral-800 px-3 py-2 text-neutral-100"
            >
              <option value="">— None (free-form) —</option>
              {selectedItemKind === "exercise"
                ? exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))
                : songs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
            </select>
          </div>
        </div>

        {/* Free-form title (shown when no item selected) */}
        {!selectedItemId && (
          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Session Title
            </label>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100"
              placeholder="e.g., Jam session, Transcription practice"
            />
          </div>
        )}

        {/* BPM fields (shown if an item is selected) */}
        {selectedItemId && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Starting Working BPM (optional)
              </label>
              <input
                type="number"
                value={startBpm}
                onChange={(e) => setStartBpm(e.target.value)}
                className="mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100"
                min="0"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Ending Working BPM (optional)
              </label>
              <input
                type="number"
                value={endBpm}
                onChange={(e) => setEndBpm(e.target.value)}
                className="mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100"
                min="0"
                placeholder="120"
              />
            </div>
          </div>
        )}

        {/* Advanced section toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-neutral-400 hover:text-neutral-200"
        >
          {showAdvanced ? "▼" : "▶"} Advanced options
        </button>

        {/* Advanced: Promotions (placeholder for now) */}
        {showAdvanced && (
          <div className="rounded bg-neutral-800 p-4 text-sm text-neutral-400">
            Promotions logging coming soon. For now, leave blank.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Log Session
        </button>
      </form>
    </div>
  );
}
