import { NextResponse } from "next/server";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Exercise } from "@/types/exercise";
import type { Song } from "@/types/song";
import { readJson, updateJsonAtomic } from "@/lib/db/fileStore";
import { nowIso } from "@/lib/session/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "sessions.json";
const SONGS_FILE = "songs.json";
const EXERCISES_FILE = "exercises.json";
const PRACTICE_TIME_FILE = "practice-time.json";
const COMPLETION_LEDGER_FILE = "session-completion-ledger.json";
const NOT_FOUND = "not-found";
const EXTENDS_SESSION = "extends-session";

type Ctx = { params: Promise<{ id: string }> };
type CompletionStatus = "pending" | "applied";
type CompletionLedger = Record<string, CompletionStatus>;

function sanitizeCompletionLedger(value: unknown): CompletionLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CompletionLedger = {};
  for (const [id, status] of Object.entries(value as Record<string, unknown>)) {
    if (status === "pending" || status === "applied") out[id] = status;
  }
  return out;
}

function sanitizePracticeTimeMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [id, seconds] of Object.entries(value as Record<string, unknown>)) {
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
      out[id] = Math.round(seconds);
    }
  }
  return out;
}

async function sessionTotalWasApplied(id: string): Promise<boolean> {
  const ledger = sanitizeCompletionLedger(
    await readJson<unknown>(COMPLETION_LEDGER_FILE, {}),
  );
  return ledger[id] !== "pending";
}

async function clearCompletionLedgerEntry(id: string): Promise<void> {
  await updateJsonAtomic<unknown, null>(COMPLETION_LEDGER_FILE, {}, (stored) => {
    const ledger = sanitizeCompletionLedger(stored);
    delete ledger[id];
    return { value: ledger, result: null };
  });
}

async function updatePracticeTimeMirror(
  itemId: string,
  totalPracticeSec: number,
): Promise<void> {
  await updateJsonAtomic<unknown, null>(PRACTICE_TIME_FILE, {}, (stored) => {
    const map = sanitizePracticeTimeMap(stored);
    map[itemId] = Math.max(0, Math.round(totalPracticeSec));
    return { value: map, result: null };
  });
}

async function applyItemDelta(
  record: SessionRecord,
  deltaSec: number,
): Promise<void> {
  if (deltaSec === 0 || record.itemKind === "freePlay") return;

  if (record.itemKind === "song") {
    const totalPracticeSec = await updateJsonAtomic<Song[], number | null>(
      SONGS_FILE,
      [],
      (songs) => {
        const idx = songs.findIndex((song) => song.id === record.itemId);
        if (idx < 0) return { value: songs, result: null };
        const next = songs.slice();
        const totalPracticeSec = Math.max(
          0,
          next[idx].totalPracticeSec + Math.round(deltaSec),
        );
        next[idx] = { ...next[idx], totalPracticeSec, updatedAt: nowIso() };
        return { value: next, result: totalPracticeSec };
      },
    );
    if (totalPracticeSec != null) {
      await updatePracticeTimeMirror(record.itemId, totalPracticeSec);
    }
    return;
  }

  await updateJsonAtomic<Exercise[], null>(EXERCISES_FILE, [], (exercises) => {
    const idx = exercises.findIndex((exercise) => exercise.id === record.itemId);
    if (idx < 0) return { value: exercises, result: null };
    const next = exercises.slice();
    const totalPracticeSec = Math.max(
      0,
      next[idx].totalPracticeSec + Math.round(deltaSec),
    );
    next[idx] = { ...next[idx], totalPracticeSec, updatedAt: nowIso() };
    return { value: next, result: null };
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "expected object" }, { status: 400 });
  }
  const patch = body as Partial<SessionRecord>;
  // Only `durationSec` is editable. Trimming-only — never extend.
  if (typeof patch.durationSec !== "number" || !Number.isFinite(patch.durationSec)) {
    return NextResponse.json(
      { error: "expected { durationSec: number }" },
      { status: 400 },
    );
  }
  const newDuration = Math.max(0, Math.round(patch.durationSec));

  try {
    const result = await updateJsonAtomic<
      SessionRecord[],
      { updated: SessionRecord; deltaSec: number }
    >(
      FILE,
      [],
      (rows) => {
        const idx = rows.findIndex((r) => r.id === id);
        if (idx < 0) throw new Error(NOT_FOUND);
        const original = rows[idx];
        if (newDuration > original.durationSec) throw new Error(EXTENDS_SESSION);
        const updated: SessionRecord = { ...original, durationSec: newDuration };
        const next = rows.slice();
        next[idx] = updated;
        return {
          value: next,
          result: {
            updated,
            deltaSec: newDuration - original.durationSec,
          },
        };
      },
    );
    if (await sessionTotalWasApplied(id)) {
      await applyItemDelta(result.updated, result.deltaSec);
    }
    return NextResponse.json(result.updated);
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === EXTENDS_SESSION) {
      return NextResponse.json(
        { error: "cannot extend a session — only trimming is allowed" },
        { status: 400 },
      );
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const removed = await updateJsonAtomic<SessionRecord[], SessionRecord>(
      FILE,
      [],
      (rows) => {
        const idx = rows.findIndex((r) => r.id === id);
        if (idx < 0) throw new Error(NOT_FOUND);
        const removed = rows[idx];
        const next = rows.slice();
        next.splice(idx, 1);
        return { value: next, result: removed };
      },
    );
    if (await sessionTotalWasApplied(id)) {
      await applyItemDelta(removed, -removed.durationSec);
    }
    await clearCompletionLedgerEntry(id);
    return NextResponse.json(removed);
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}
