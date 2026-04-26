import type { Song, Settings } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import { DEFAULT_SETTINGS } from "@/types/song";
import type { Repository } from "./repository";

const SONGS_URL = "/api/songs";
const EXERCISES_URL = "/api/exercises";
const SETTINGS_URL = "/api/settings";
const SESSIONS_URL = "/api/sessions";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function putJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}`);
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
function normalizeExercise(row: Exercise): Exercise {
  const next = { ...row };
  if (typeof next.openEnded !== "boolean") next.openEnded = false;
  if (typeof next.metronomeEnabled !== "boolean") next.metronomeEnabled = true;
  return next;
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
    return sortSongs(rows);
  }

  async getSong(id: string): Promise<Song | null> {
    const rows = await getJson<Song[]>(SONGS_URL);
    return rows.find((s) => s.id === id) ?? null;
  }

  upsertSong(song: Song): Promise<void> {
    return this.chainSongs(async () => {
      const rows = await getJson<Song[]>(SONGS_URL);
      const idx = rows.findIndex((s) => s.id === song.id);
      if (idx >= 0) rows[idx] = song;
      else rows.push(song);
      await putJson(SONGS_URL, rows);
    });
  }

  deleteSong(id: string): Promise<void> {
    return this.chainSongs(async () => {
      const rows = await getJson<Song[]>(SONGS_URL);
      await putJson(SONGS_URL, rows.filter((s) => s.id !== id));
    });
  }

  reorderSongs(orderedIds: string[]): Promise<void> {
    return this.chainSongs(async () => {
      const rows = await getJson<Song[]>(SONGS_URL);
      const byId = new Map(rows.map((s) => [s.id, s]));
      const next: Song[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const row = byId.get(orderedIds[i]);
        if (row) next.push({ ...row, sortIndex: i });
      }
      // Preserve any rows not in orderedIds (shouldn't happen, but defensive).
      for (const row of rows) {
        if (!orderedIds.includes(row.id)) next.push(row);
      }
      await putJson(SONGS_URL, next);
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
      const rows = await getJson<Exercise[]>(EXERCISES_URL);
      const idx = rows.findIndex((e) => e.id === exercise.id);
      if (idx >= 0) rows[idx] = exercise;
      else rows.push(exercise);
      await putJson(EXERCISES_URL, rows);
    });
  }

  deleteExercise(id: string): Promise<void> {
    return this.chainExercises(async () => {
      const rows = await getJson<Exercise[]>(EXERCISES_URL);
      await putJson(EXERCISES_URL, rows.filter((e) => e.id !== id));
    });
  }

  reorderExercises(orderedIds: string[]): Promise<void> {
    return this.chainExercises(async () => {
      const rows = await getJson<Exercise[]>(EXERCISES_URL);
      const byId = new Map(rows.map((e) => [e.id, e]));
      const next: Exercise[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const row = byId.get(orderedIds[i]);
        if (row) next.push({ ...row, sortIndex: i });
      }
      for (const row of rows) {
        if (!orderedIds.includes(row.id)) next.push(row);
      }
      await putJson(EXERCISES_URL, next);
    });
  }

  async getSettings(): Promise<Settings> {
    const stored = await getJson<Partial<Settings>>(SETTINGS_URL);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  saveSettings(s: Settings): Promise<void> {
    return this.chainSettings(async () => {
      await putJson(SETTINGS_URL, s);
    });
  }

  async listSessions(): Promise<SessionRecord[]> {
    return await getJson<SessionRecord[]>(SESSIONS_URL);
  }

  async appendSession(rec: SessionRecord): Promise<void> {
    const res = await fetch(SESSIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    });
    if (!res.ok) throw new Error(`POST ${SESSIONS_URL} failed: ${res.status}`);
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

  async resetAllStatistics(): Promise<void> {
    // Zero totalPracticeSec on every song and exercise.
    const songs = await getJson<Song[]>(SONGS_URL);
    const songsZeroed = songs.map((s) => ({ ...s, totalPracticeSec: 0 }));
    await this.chainSongs(async () => {
      await putJson(SONGS_URL, songsZeroed);
    });
    const exercises = await getJson<Exercise[]>(EXERCISES_URL);
    const exercisesZeroed = exercises.map((e) => ({
      ...e,
      totalPracticeSec: 0,
    }));
    await this.chainExercises(async () => {
      await putJson(EXERCISES_URL, exercisesZeroed);
    });
    // Clear session history.
    await putJson(SESSIONS_URL, []);
  }

  async factoryReset(): Promise<void> {
    await this.chainSongs(async () => {
      await putJson(SONGS_URL, []);
    });
    await this.chainExercises(async () => {
      await putJson(EXERCISES_URL, []);
    });
    await putJson(SESSIONS_URL, []);
  }
}
