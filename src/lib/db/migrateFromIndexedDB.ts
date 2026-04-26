import { getLegacyIndexedDBRepository } from "./localRepository";

const FLAG_KEY = "gspm:migrated-to-files";

/**
 * One-time IndexedDB → JSON file migration. Called on app boot from a
 * client component. Reads songs/exercises/settings out of the legacy
 * Dexie store and POSTs them to /api/migrate, which only writes when
 * the corresponding JSON file is empty/missing. IndexedDB is left
 * intact so the user can verify before discarding.
 */
export async function migrateFromIndexedDBOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(FLAG_KEY) === "1") return;

  try {
    const legacy = getLegacyIndexedDBRepository();
    const [songs, exercises, settings] = await Promise.all([
      legacy.listSongs().catch(() => []),
      legacy.listExercises().catch(() => []),
      legacy.getSettings().catch(() => null),
    ]);

    if (songs.length === 0 && exercises.length === 0 && !settings) {
      window.localStorage.setItem(FLAG_KEY, "1");
      return;
    }

    const res = await fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songs, exercises, settings }),
    });
    if (res.ok) {
      window.localStorage.setItem(FLAG_KEY, "1");
    }
  } catch {
    // Leave the flag unset so we retry next boot.
  }
}
