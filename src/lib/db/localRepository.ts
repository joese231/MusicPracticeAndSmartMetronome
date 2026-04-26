import type { Song, Settings } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import { DEFAULT_SETTINGS } from "@/types/song";
import type { Repository } from "./repository";
import { getDB } from "./schema";
import { FileRepository } from "./fileRepository";

export class LocalRepository implements Repository {
  async listSongs(): Promise<Song[]> {
    const rows = await getDB().songs.toArray();
    return rows.sort((a, b) => {
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return a.title.localeCompare(b.title);
    });
  }

  async getSong(id: string): Promise<Song | null> {
    const s = await getDB().songs.get(id);
    return s ?? null;
  }

  async upsertSong(song: Song): Promise<void> {
    await getDB().songs.put(song);
  }

  async deleteSong(id: string): Promise<void> {
    await getDB().songs.delete(id);
  }

  async reorderSongs(orderedIds: string[]): Promise<void> {
    const db = getDB();
    await db.transaction("rw", db.songs, async () => {
      const rows = await db.songs.bulkGet(orderedIds);
      const updates: Song[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const row = rows[i];
        if (row) updates.push({ ...row, sortIndex: i });
      }
      await db.songs.bulkPut(updates);
    });
  }

  async listExercises(): Promise<Exercise[]> {
    const rows = await getDB().exercises.toArray();
    return rows.sort((a, b) => {
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return a.name.localeCompare(b.name);
    });
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const e = await getDB().exercises.get(id);
    return e ?? null;
  }

  async upsertExercise(exercise: Exercise): Promise<void> {
    await getDB().exercises.put(exercise);
  }

  async deleteExercise(id: string): Promise<void> {
    await getDB().exercises.delete(id);
  }

  async reorderExercises(orderedIds: string[]): Promise<void> {
    const db = getDB();
    await db.transaction("rw", db.exercises, async () => {
      const rows = await db.exercises.bulkGet(orderedIds);
      const updates: Exercise[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const row = rows[i];
        if (row) updates.push({ ...row, sortIndex: i });
      }
      await db.exercises.bulkPut(updates);
    });
  }

  async getSettings(): Promise<Settings> {
    const row = await getDB().settings.get("singleton");
    if (!row) return { ...DEFAULT_SETTINGS };
    const { id: _id, ...stored } = row;
    // Merge over defaults so fields added in later app versions
    // (e.g. autoAdvanceBlocks) aren't undefined on legacy rows.
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(s: Settings): Promise<void> {
    await getDB().settings.put({ id: "singleton", ...s });
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [];
  }

  async appendSession(_rec: SessionRecord): Promise<void> {
    // legacy adapter is migration-only — no-op.
  }

  async updateSession(
    _id: string,
    patch: { durationSec: number },
  ): Promise<SessionRecord> {
    // legacy adapter is migration-only — no-op. Return a zero-shape record so
    // callers that ignore the return value still type-check.
    return {
      id: "",
      itemId: "",
      itemKind: "song",
      itemTitle: "",
      startedAt: "",
      endedAt: "",
      durationSec: patch.durationSec,
      endedReason: "complete",
      plannedMinutes: 0,
      startWorkingBpm: 0,
      endWorkingBpm: 0,
      startTroubleBpms: [],
      endTroubleBpms: [],
      promotions: [],
    };
  }

  async deleteSession(_id: string): Promise<SessionRecord> {
    return {
      id: "",
      itemId: "",
      itemKind: "song",
      itemTitle: "",
      startedAt: "",
      endedAt: "",
      durationSec: 0,
      endedReason: "complete",
      plannedMinutes: 0,
      startWorkingBpm: 0,
      endWorkingBpm: 0,
      startTroubleBpms: [],
      endTroubleBpms: [],
      promotions: [],
    };
  }

  async resetAllStatistics(): Promise<void> {
    // legacy adapter is migration-only — no-op.
  }

  async factoryReset(): Promise<void> {
    // legacy adapter is migration-only — no-op.
  }
}

let _repo: Repository | null = null;

export function getRepository(): Repository {
  if (!_repo) _repo = new FileRepository();
  return _repo;
}

let _legacyRepo: LocalRepository | null = null;

/**
 * Returns the IndexedDB-backed repository. Used only by the one-time
 * IndexedDB → JSON file migration on app boot. Do not use for new reads
 * or writes — `getRepository()` is the source of truth.
 */
export function getLegacyIndexedDBRepository(): LocalRepository {
  if (!_legacyRepo) _legacyRepo = new LocalRepository();
  return _legacyRepo;
}
