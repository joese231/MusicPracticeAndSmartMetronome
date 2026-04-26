import type { Song, Settings } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";

export interface Repository {
  listSongs(): Promise<Song[]>;
  getSong(id: string): Promise<Song | null>;
  upsertSong(song: Song): Promise<void>;
  deleteSong(id: string): Promise<void>;
  /** Persist a new order for the song list. `orderedIds` is the full list. */
  reorderSongs(orderedIds: string[]): Promise<void>;

  listExercises(): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | null>;
  upsertExercise(exercise: Exercise): Promise<void>;
  deleteExercise(id: string): Promise<void>;
  reorderExercises(orderedIds: string[]): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;

  listSessions(): Promise<SessionRecord[]>;
  appendSession(rec: SessionRecord): Promise<void>;
}
