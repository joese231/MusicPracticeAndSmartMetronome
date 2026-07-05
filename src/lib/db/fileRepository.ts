import type { Song, Settings } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SONG_SESSION_MINUTES,
  migrateDefaultExerciseTemplate,
  migrateDefaultSongTemplate,
  migrateExerciseTemplate,
  migrateSongTemplate,
} from "@/types/song";
import type { Repository } from "./repository";

const SONGS_URL = "/api/songs";
const EXERCISES_URL = "/api/exercises";
const SETTINGS_URL = "/api/settings";
const SESSIONS_URL = "/api/sessions";
const COMPLETE_SESSION_URL = "/api/sessions/complete";
const PRACTICE_TIME_URL = "/api/practice-time";
const RESET_STATISTICS_URL = "/api/statistics/reset";
const FACTORY_RESET_URL = "/api/factory-reset";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let suffix = "";
    try {
      const json = (await res.json()) as { error?: string };
      suffix = json.error ? `: ${json.error}` : "";
    } catch {
      suffix = "";
    }
    throw new Error(`PATCH ${url} failed: ${res.status}${suffix}`);
  }
  return (await res.json()) as T;
}

async function deleteJson(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`);
}

function sortSongs(rows: Song[]): Song[] {
  return [...rows].sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.title.localeCompare(b.title);
  });
}

function sortExercises(rows: Exercise[]): Exercise[] {
  return [...rows].sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.name.localeCompare(b.name);
  });
}

// Backfill fields added in newer app versions onto rows that may have been
// written by an older build. Lazy — applied on read; the corrected shape is
// persisted on the next upsert.
function normalizeSong(row: Song): Song {
  const next = { ...row };
  if (
    next.practiceMode !== "simple" &&
    next.practiceMode !== "timed" &&
    next.practiceMode !== "openEnded"
  ) {
    next.practiceMode = "smart";
  }
  if (typeof next.includeWarmupBlock !== "boolean") {
    next.includeWarmupBlock = true;
  }
  if (typeof next.defaultSessionMinutes !== "number") {
    next.defaultSessionMinutes = DEFAULT_SONG_SESSION_MINUTES;
  }
  if (typeof next.metronomeEnabled !== "boolean") {
    next.metronomeEnabled = true;
  }
  next.blockTemplate = migrateSongTemplate(next.blockTemplate);
  return next;
}

function normalizeExercise(row: Exercise): Exercise {
  const next = { ...row };
  if (typeof next.openEnded !== "boolean") next.openEnded = false;
  if (typeof next.metronomeEnabled !== "boolean") next.metronomeEnabled = true;
  if (next.openEnded) {
    next.practiceMode = "openEnded";
  } else if (
    next.practiceMode !== "simple" &&
    next.practiceMode !== "timed" &&
    next.practiceMode !== "openEnded"
  ) {
    next.practiceMode = "smart";
  }
  if (typeof next.includeWarmupBlock !== "boolean") {
    next.includeWarmupBlock = true;
  }
  next.blockTemplate = migrateExerciseTemplate(next.blockTemplate);
  return next;
}

function normalizeSettings(row: Partial<Settings>): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...row };
  merged.defaultSongBlockTemplate = migrateDefaultSongTemplate(
    merged.defaultSongBlockTemplate,
  );
  merged.defaultExerciseBlockTemplate = migrateDefaultExerciseTemplate(
    merged.defaultExerciseBlockTemplate,
  );
  return merged;
}

export class FileRepository implements Repository {
  // Per-collection write queue: serialize read-modify-write so concurrent
  // mutations from the same client don't lose updates.
  private songsQueue: Promise<unknown> = Promise.resolve();
  private exercisesQueue: Promise<unknown> = Promise.resolve();
  private settingsQueue: Promise<unknown> = Promise.resolve();

  private chainSongs<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.songsQueue.then(fn, fn);
    this.songsQueue = next.catch(() => undefined);
    return next;
  }
  private chainExercises<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.exercisesQueue.then(fn, fn);
    this.exercisesQueue = next.catch(() => undefined);
    return next;
  }
  private chainSettings<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.settingsQueue.then(fn, fn);
    this.settingsQueue = next.catch(() => undefined);
    return next;
  }

  async listSongs(): Promise<Song[]> {
    const rows = await getJson<Song[]>(SONGS_URL);
    return sortSongs(rows.map(normalizeSong));
  }

  async getSong(id: string): Promise<Song | null> {
    const rows = await getJson<Song[]>(SONGS_URL);
    const found = rows.find((s) => s.id === id);
    return found ? normalizeSong(found) : null;
  }

  upsertSong(song: Song): Promise<void> {
    return this.chainSongs(async () => {
      const existing = await this.getSong(song.id);
      if (!existing) {
        await postJson<{ ok: true }>(SONGS_URL, song);
        return;
      }
      const {
        id: _id,
        createdAt: _createdAt,
        totalPracticeSec: _totalPracticeSec,
        sortIndex: _sortIndex,
        ...patch
      } = song;
      await patchJson<Song>(`${SONGS_URL}/${encodeURIComponent(song.id)}`, {
        expectedUpdatedAt: existing.updatedAt,
        patch,
      });
    });
  }

  deleteSong(id: string): Promise<void> {
    return this.chainSongs(async () => {
      await deleteJson(`${SONGS_URL}/${encodeURIComponent(id)}`);
    });
  }

  reorderSongs(orderedIds: string[]): Promise<void> {
    return this.chainSongs(async () => {
      await patchJson<{ ok: true }>(`${SONGS_URL}/reorder`, { orderedIds });
    });
  }

  async listExercises(): Promise<Exercise[]> {
    const rows = await getJson<Exercise[]>(EXERCISES_URL);
    return sortExercises(rows.map(normalizeExercise));
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const rows = await getJson<Exercise[]>(EXERCISES_URL);
    const found = rows.find((e) => e.id === id);
    return found ? normalizeExercise(found) : null;
  }

  upsertExercise(exercise: Exercise): Promise<void> {
    return this.chainExercises(async () => {
      const existing = await this.getExercise(exercise.id);
      if (!existing) {
        await postJson<{ ok: true }>(EXERCISES_URL, exercise);
        return;
      }
      const {
        id: _id,
        createdAt: _createdAt,
        totalPracticeSec: _totalPracticeSec,
        sortIndex: _sortIndex,
        ...patch
      } = exercise;
      await patchJson<Exercise>(
        `${EXERCISES_URL}/${encodeURIComponent(exercise.id)}`,
        {
          expectedUpdatedAt: existing.updatedAt,
          patch,
        },
      );
    });
  }

  deleteExercise(id: string): Promise<void> {
    return this.chainExercises(async () => {
      await deleteJson(`${EXERCISES_URL}/${encodeURIComponent(id)}`);
    });
  }

  reorderExercises(orderedIds: string[]): Promise<void> {
    return this.chainExercises(async () => {
      await patchJson<{ ok: true }>(`${EXERCISES_URL}/reorder`, { orderedIds });
    });
  }

  async getSettings(): Promise<Settings> {
    const stored = await getJson<Partial<Settings>>(SETTINGS_URL);
    return normalizeSettings(stored);
  }

  saveSettings(s: Settings): Promise<void> {
    return this.chainSettings(async () => {
      await patchJson<{ ok: true }>(SETTINGS_URL, s);
    });
  }

  async listSessions(): Promise<SessionRecord[]> {
    return await getJson<SessionRecord[]>(SESSIONS_URL);
  }

  async appendSession(rec: SessionRecord): Promise<void> {
    if (rec.itemKind === "song" || rec.itemKind === "exercise") {
      await this.completeSession(rec);
      return;
    }

    const res = await fetch(SESSIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    });
    if (!res.ok) throw new Error(`POST ${SESSIONS_URL} failed: ${res.status}`);
  }

  async completeSession(rec: SessionRecord): Promise<void> {
    const res = await fetch(COMPLETE_SESSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record: rec }),
    });
    if (!res.ok) {
      throw new Error(`POST ${COMPLETE_SESSION_URL} failed: ${res.status}`);
    }
  }

  async updateSession(
    id: string,
    patch: { durationSec: number },
  ): Promise<SessionRecord> {
    const url = `${SESSIONS_URL}/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status}`);
    return (await res.json()) as SessionRecord;
  }

  async deleteSession(id: string): Promise<SessionRecord> {
    const url = `${SESSIONS_URL}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`);
    return (await res.json()) as SessionRecord;
  }

  async adjustPracticeTime(
    itemKind: "song" | "exercise",
    itemId: string,
    deltaSec: number,
  ): Promise<number> {
    const res = await fetch(PRACTICE_TIME_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemKind, itemId, deltaSec }),
    });
    if (!res.ok) throw new Error(`PATCH ${PRACTICE_TIME_URL} failed: ${res.status}`);
    const body = (await res.json()) as { totalPracticeSec: number };
    return body.totalPracticeSec;
  }

  async resetAllStatistics(): Promise<void> {
    await postJson<{ ok: true }>(RESET_STATISTICS_URL, {});
  }

  async factoryReset(): Promise<void> {
    await postJson<{ ok: true }>(FACTORY_RESET_URL, {});
  }
}
