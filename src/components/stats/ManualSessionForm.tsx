"use client";

import { useEffect, useMemo, useState } from "react";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { useSessionHistoryStore } from "@/lib/store/useSessionHistoryStore";
import {
  applyWorkingPromotions,
  buildManualWorkingPromotions,
  parseDurationToSeconds,
  createManualSessionRecord,
} from "@/lib/session/manualSessionUtils";
import type { Song } from "@/types/song";
import type { Exercise } from "@/types/exercise";

// Styling constants to avoid duplication
const INPUT_CLASS = "mt-1 w-full rounded bg-neutral-800 px-3 py-2 text-neutral-100";
const SELECT_CLASS = "rounded bg-neutral-800 px-3 py-2 text-neutral-100";

export function ManualSessionForm() {
  const songs = useSongsStore((s) => s.songs);
  const loadSongs = useSongsStore((s) => s.load);
  const exercises = useExercisesStore((s) => s.exercises);
  const loadExercises = useExercisesStore((s) => s.load);
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
  const [promotionCount, setPromotionCount] = useState<string>("0");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  // Get the selected item (if any)
  const selectedItem = useMemo(
    () =>
      selectedItemKind === "song"
        ? songs.find((s) => s.id === selectedItemId)
        : exercises.find((e) => e.id === selectedItemId),
    [exercises, selectedItemId, selectedItemKind, songs],
  );

  useEffect(() => {
    if (!selectedItemId) {
      setStartBpm("");
      setPromotionCount("0");
      return;
    }
    if (!selectedItem) return;

    const workingBpm = selectedItem.workingBpm;
    setStartBpm(
      typeof workingBpm === "number" && workingBpm > 0
        ? String(workingBpm)
        : "",
    );
    setPromotionCount("0");
  }, [selectedItem, selectedItemId]);

  const startBpmNumber =
    /^\d+$/.test(startBpm.trim()) && Number(startBpm) > 0
      ? Number(startBpm)
      : null;
  const promotionCountNumber =
    promotionCount.trim() === ""
      ? 0
      : /^\d+$/.test(promotionCount.trim())
        ? Number(promotionCount)
        : null;
  const derivedEndBpm =
    selectedItem && startBpmNumber != null && promotionCountNumber != null
      ? applyWorkingPromotions(
          startBpmNumber,
          promotionCountNumber,
          selectedItem.stepPercent,
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    try {
      // Validate date and time
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

      // Validate BPM fields
      let startBpmNum: number | undefined;
      let endBpmNum: number | undefined;
      let promotionCountNum = 0;

      if (selectedItemId && !selectedItem) {
        throw new Error("Selected item could not be found");
      }

      if (selectedItem) {
        const trimmedStartBpm = startBpm.trim();
        const trimmedPromotionCount = promotionCount.trim();

        if (trimmedStartBpm) {
          startBpmNum = parseInt(trimmedStartBpm, 10);
          if (!/^\d+$/.test(trimmedStartBpm) || startBpmNum < 1) {
            throw new Error("Starting BPM must be a positive number");
          }
        }

        if (trimmedPromotionCount) {
          promotionCountNum = parseInt(trimmedPromotionCount, 10);
          if (
            !/^\d+$/.test(trimmedPromotionCount) ||
            promotionCountNum < 0
          ) {
            throw new Error("Number of promotions must be zero or greater");
          }
        }

        if (promotionCountNum > 0 && startBpmNum === undefined) {
          throw new Error("Starting BPM is required when logging promotions");
        }

        if (startBpmNum !== undefined) {
          endBpmNum = applyWorkingPromotions(
            startBpmNum,
            promotionCountNum,
            selectedItem.stepPercent,
          );
        }
      } else if (startBpm) {
        const freeFormStartBpm = parseInt(startBpm, 10);
        if (isNaN(freeFormStartBpm) || freeFormStartBpm < 1) {
          throw new Error("Starting BPM must be a positive number");
        }
      }

      // Combine date and time
      const startedAt = new Date(`${date}T${time}`).toISOString();
      const now = new Date();
      if (new Date(startedAt) > now) {
        throw new Error("Session cannot be in the future");
      }

      // Create the session record with proper type narrowing
      let params: Parameters<typeof createManualSessionRecord>[0];
      const workingPromotions =
        selectedItem && startBpmNum !== undefined
          ? buildManualWorkingPromotions({
              startBpm: startBpmNum,
              promotionCount: promotionCountNum,
              stepPercent: selectedItem.stepPercent,
              startedAt,
              durationSec,
            })
          : [];

      if (selectedItem) {
        if (selectedItemKind === "exercise") {
          const exercise = selectedItem as Exercise;
          params = {
            exerciseId: exercise.id,
            exerciseTitle: exercise.name,
            startedAt,
            durationSec,
            ...(startBpmNum !== undefined && { startWorkingBpm: startBpmNum }),
            ...(endBpmNum !== undefined && { endWorkingBpm: endBpmNum }),
            promotions: workingPromotions,
          };
        } else {
          const song = selectedItem as Song;
          params = {
            songId: song.id,
            songTitle: song.title,
            startedAt,
            durationSec,
            ...(startBpmNum !== undefined && { startWorkingBpm: startBpmNum }),
            ...(endBpmNum !== undefined && { endWorkingBpm: endBpmNum }),
            promotions: workingPromotions,
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
      if (record.itemKind === "song") {
        await loadSongs();
      } else if (record.itemKind === "exercise") {
        await loadExercises();
      }

      // Success feedback
      setSuccess(true);
      setDate(new Date().toISOString().split("T")[0]);
      setTime(new Date().toTimeString().slice(0, 5));
      setDuration("25m");
      setSelectedItemId("");
      setSessionTitle("");
      setStartBpm("");
      setPromotionCount("0");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="sr-only">Log Manual Session</h2>

      {error && (
        <div className="mb-4 rounded bg-red-900 p-3 text-red-100" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded bg-green-900 p-3 text-green-100" role="alert">
          Session logged successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" role="form">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Duration (e.g., &quot;25m&quot;, &quot;25m 30s&quot;, or &quot;1500s&quot;)
          </label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={INPUT_CLASS}
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
                setStartBpm("");
                setPromotionCount("0");
              }}
              className={SELECT_CLASS}
            >
              <option value="exercise">Exercise</option>
              <option value="song">Song</option>
            </select>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className={`flex-1 ${SELECT_CLASS}`}
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
              className={INPUT_CLASS}
              placeholder="e.g., Jam session, Transcription practice"
            />
          </div>
        )}

        {/* BPM fields (shown if an item is selected) */}
        {selectedItemId && (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Starting Working BPM (optional)
              </label>
              <input
                type="number"
                value={startBpm}
                onChange={(e) => setStartBpm(e.target.value)}
                className={INPUT_CLASS}
                min="1"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Number of promotions
              </label>
              <input
                type="number"
                value={promotionCount}
                onChange={(e) => setPromotionCount(e.target.value)}
                className={INPUT_CLASS}
                min="0"
                step="1"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Ending Working BPM
              </label>
              <input
                type="number"
                value={derivedEndBpm ?? ""}
                readOnly
                className={`${INPUT_CLASS} text-neutral-400`}
                min="1"
                placeholder="—"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accent-strong"
        >
          Log Session
        </button>
      </form>
    </div>
  );
}
