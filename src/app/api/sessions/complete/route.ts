import { NextResponse } from "next/server";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";
import { validateSessionRecord } from "@/lib/api/validation";
import { nowIso } from "@/lib/session/tempo";
import { updateJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSIONS_FILE = "sessions.json";
const SONGS_FILE = "songs.json";
const EXERCISES_FILE = "exercises.json";
const PRACTICE_TIME_FILE = "practice-time.json";
const COMPLETION_LEDGER_FILE = "session-completion-ledger.json";
const ITEM_NOT_FOUND = "item-not-found";

type CompletionStatus = "pending" | "applied";
type CompletionLedger = Record<string, CompletionStatus>;
type AppendResult = { appended: boolean; record: SessionRecord };

function sanitizeCompletionLedger(value: unknown): CompletionLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CompletionLedger = {};
  for (const [id, status] of Object.entries(value as Record<string, unknown>)) {
    if (status === "pending" || status === "applied") out[id] = status;
  }
  return out;
}

async function ensureCompletionPending(id: string): Promise<CompletionStatus> {
  return updateJsonAtomic<unknown, CompletionStatus>(
    COMPLETION_LEDGER_FILE,
    {},
    (stored) => {
      const ledger = sanitizeCompletionLedger(stored);
      if (ledger[id] === "applied") {
        return { value: ledger, result: "applied" };
      }
      ledger[id] = "pending";
      return { value: ledger, result: "pending" };
    },
  );
}

async function markCompletionApplied(id: string): Promise<void> {
  await updateJsonAtomic<unknown, null>(COMPLETION_LEDGER_FILE, {}, (stored) => {
    const ledger = sanitizeCompletionLedger(stored);
    ledger[id] = "applied";
    return { value: ledger, result: null };
  });
}

async function clearCompletionLedgerEntry(id: string): Promise<void> {
  await updateJsonAtomic<unknown, null>(COMPLETION_LEDGER_FILE, {}, (stored) => {
    const ledger = sanitizeCompletionLedger(stored);
    delete ledger[id];
    return { value: ledger, result: null };
  });
}

async function appendSessionOnce(rec: SessionRecord): Promise<AppendResult> {
  return updateJsonAtomic<SessionRecord[], AppendResult>(
    SESSIONS_FILE,
    [],
    (rows) => {
      const existing = rows.find((row) => row.id === rec.id);
      if (existing) {
        return { value: rows, result: { appended: false, record: existing } };
      }
      return { value: [...rows, rec], result: { appended: true, record: rec } };
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
  const valid = validateSessionRecord(rec);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }
  if (valid.value.itemKind !== "song" && valid.value.itemKind !== "exercise") {
    return NextResponse.json(
      { error: "complete session requires a song or exercise record" },
      { status: 400 },
    );
  }

  try {
    const ledgerStatus = await ensureCompletionPending(valid.value.id);
    const { appended, record } = await appendSessionOnce(valid.value);

    if (ledgerStatus !== "applied" && record.itemKind === "song") {
      const totalPracticeSec = await incrementSongTotal(
        record.itemId,
        record.durationSec,
      );
      await updatePracticeTimeMirror(record.itemId, totalPracticeSec);
      await markCompletionApplied(record.id);
    } else if (ledgerStatus !== "applied") {
      await incrementExerciseTotal(record.itemId, record.durationSec);
      await markCompletionApplied(record.id);
    }

    return NextResponse.json(
      appended ? { ok: true } : { ok: true, deduped: true },
    );
  } catch (err) {
    if (err instanceof Error && err.message === ITEM_NOT_FOUND) {
      await removeSession(valid.value.id);
      await clearCompletionLedgerEntry(valid.value.id);
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }
    throw err;
  }
}
