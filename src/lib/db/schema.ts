import Dexie, { type Table } from "dexie";
import type { Song, Settings } from "@/types/song";
import type { Exercise } from "@/types/exercise";

export type SettingsRow = Settings & { id: "singleton" };

type LegacySongRow = Omit<Song, "troubleSpots" | "sortIndex"> & {
  troubleBpm?: number | null;
  troubleSpots?: Song["troubleSpots"];
  sortIndex?: number;
};

export class AppDB extends Dexie {
  songs!: Table<Song, string>;
  settings!: Table<SettingsRow, string>;
  exercises!: Table<Exercise, string>;

  constructor() {
    super("guitar-practice");
    this.version(1).stores({
      songs: "id, title, updatedAt",
      settings: "id",
    });
    this.version(2)
      .stores({
        songs: "id, title, updatedAt",
        settings: "id",
      })
      .upgrade(async (tx) => {
        await tx
          .table<LegacySongRow, string>("songs")
          .toCollection()
          .modify((row) => {
            const legacyBpm = row.troubleBpm;
            row.troubleSpots =
              legacyBpm != null ? [{ bpm: legacyBpm }] : [];
            delete row.troubleBpm;
          });
      });
    this.version(3)
      .stores({
        songs: "id, title, updatedAt, sortIndex",
        settings: "id",
      })
      .upgrade(async (tx) => {
        // Seed sortIndex from the existing (alphabetical) order so existing
        // users land on the same visual ordering they had yesterday.
        const rows = await tx
          .table<LegacySongRow, string>("songs")
          .toArray();
        rows.sort((a, b) => a.title.localeCompare(b.title));
        for (let i = 0; i < rows.length; i++) {
          rows[i].sortIndex = i;
        }
        await tx.table<LegacySongRow, string>("songs").bulkPut(rows);
      });
    this.version(4).stores({
      songs: "id, title, updatedAt, sortIndex",
      settings: "id",
      exercises: "id, name, updatedAt, sortIndex",
    });
    this.version(5)
      .stores({
        songs: "id, title, updatedAt, sortIndex",
        settings: "id",
        exercises: "id, name, updatedAt, sortIndex",
      })
      .upgrade(async (tx) => {
        await tx
          .table<Exercise, string>("exercises")
          .toCollection()
          .modify((row) => {
            if (typeof row.sessionMinutes !== "number") {
              row.sessionMinutes = 5;
            }
          });
      });
    this.version(6)
      .stores({
        songs: "id, title, updatedAt, sortIndex",
        settings: "id",
        exercises: "id, name, updatedAt, sortIndex",
      })
      .upgrade(async (tx) => {
        await tx
          .table<Song, string>("songs")
          .toCollection()
          .modify((row) => {
            if (row.warmupBpm === undefined) row.warmupBpm = null;
          });
        await tx
          .table<Exercise, string>("exercises")
          .toCollection()
          .modify((row) => {
            if (row.warmupBpm === undefined) row.warmupBpm = null;
          });
      });
    this.version(7)
      .stores({
        songs: "id, title, updatedAt, sortIndex",
        settings: "id",
        exercises: "id, name, updatedAt, sortIndex",
      })
      .upgrade(async (tx) => {
        await tx
          .table<Exercise, string>("exercises")
          .toCollection()
          .modify((row) => {
            if (typeof row.openEnded !== "boolean") row.openEnded = false;
            if (typeof row.metronomeEnabled !== "boolean") {
              row.metronomeEnabled = true;
            }
          });
      });
  }
}

let _db: AppDB | null = null;

export function getDB(): AppDB {
  if (!_db) _db = new AppDB();
  return _db;
}
