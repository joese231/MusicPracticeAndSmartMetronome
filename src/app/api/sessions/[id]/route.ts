import { NextResponse } from "next/server";
import type { SessionRecord } from "@/types/sessionRecord";
import { updateJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "sessions.json";
const NOT_FOUND = "not-found";
const EXTENDS_SESSION = "extends-session";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = params.id;
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
    const updated = await updateJsonAtomic<SessionRecord[], SessionRecord>(
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
        return { value: next, result: updated };
      },
    );
    return NextResponse.json(updated);
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
  const id = params.id;
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
    return NextResponse.json(removed);
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}
