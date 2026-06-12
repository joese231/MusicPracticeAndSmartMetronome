import { NextResponse } from "next/server";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";
import { nowIso } from "@/lib/session/tempo";
import { updateJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSIONS_FILE = "sessions.json";
const SONGS_FILE = "songs.json";
const EXERCISES_FILE = "exercises.json";
const PRACTICE_TIME_FILE = "practice-time.json";
const DUPLICATE_SESSION = "duplicate-session";
const ITEM_NOT_FOUND = "item-not-found";

function isSessionRecord(value: unknown): value is SessionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Partial<SessionRecord>;
  return (
    typeof rec.id === "string" &&
    rec.id.length > 0 &&
    typeof rec.itemId === "string" &&
    rec.itemId.length > 0 &&
    (rec.itemKind === "song" || rec.itemKind === "exercise") &&
    typeof rec.durationSec === "number" &&
    Number.isFinite(rec.durationSec) &&
    rec.durationSec >= 0
  );
}

async function appendSessionOnce(rec: SessionRecord): Promise<boolean> {
  return updateJsonAtomic<SessionRecord[], boolean>(
    SESSIONS_FILE,
    [],
    (rows) => {
      if (rows.some((row) => row.id === rec.id)) {
        return { value: rows, result: false };
      }
      return { value: [...rows, rec], result: true };
    },
  );
}

async function removeSession(id: string): Promise<void> {
  await updateJsonAtomic<SessionRecord[], null>(SESSIONS_FILE, [], (rows) => ({
    value: rows.filter((row) => row.id !== id),
    result: null,
  }));
}

async function updatePracticeTimeMirror(
  itemId: string,
  totalPracticeSec: number,
): Promise<void> {
  await updateJsonAtomic<Record<string, number>, null>(
    PRACTICE_TIME_FILE,
    {},
    (map) => ({
      value: {
        ...map,
        [itemId]: Math.max(map[itemId] ?? 0, Math.round(totalPracticeSec)),
      },
      result: null,
    }),
  );
}

async function incrementSongTotal(
  itemId: string,
  durationSec: number,
): Promise<number> {
  return updateJsonAtomic<Song[], number>(SONGS_FILE, [], (songs) => {
    const idx = songs.findIndex((song) => song.id === itemId);
    if (idx < 0) throw new Error(ITEM_NOT_FOUND);
    const next = songs.slice();
    const totalPracticeSec = Math.max(
      0,
      next[idx].totalPracticeSec + Math.round(durationSec),
    );
    next[idx] = {
      ...next[idx],
      totalPracticeSec,
      updatedAt: nowIso(),
    };
    return { value: next, result: totalPracticeSec };
  });
}

async function incrementExerciseTotal(
  itemId: string,
  durationSec: number,
): Promise<void> {
  await updateJsonAtomic<Exercise[], null>(EXERCISES_FILE, [], (exercises) => {
    const idx = exercises.findIndex((exercise) => exercise.id === itemId);
    if (idx < 0) throw new Error(ITEM_NOT_FOUND);
    const next = exercises.slice();
    next[idx] = {
      ...next[idx],
      totalPracticeSec: Math.max(
        0,
        next[idx].totalPracticeSec + Math.round(durationSec),
      ),
      updatedAt: nowIso(),
    };
    return { value: next, result: null };
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const rec = (body as { record?: unknown } | null)?.record;
  if (!isSessionRecord(rec)) {
    return NextResponse.json({ error: "invalid record" }, { status: 400 });
  }

  try {
    const appended = await appendSessionOnce(rec);
    if (!appended) throw new Error(DUPLICATE_SESSION);
    if (rec.itemKind === "song") {
      const totalPracticeSec = await incrementSongTotal(
        rec.itemId,
        rec.durationSec,
      );
      await updatePracticeTimeMirror(rec.itemId, totalPracticeSec);
    } else {
      await incrementExerciseTotal(rec.itemId, rec.durationSec);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === DUPLICATE_SESSION) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    if (err instanceof Error && err.message === ITEM_NOT_FOUND) {
      await removeSession(rec.id);
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }
    throw err;
  }
}
