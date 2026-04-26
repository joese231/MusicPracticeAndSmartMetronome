import { NextResponse } from "next/server";
import type { SessionRecord } from "@/types/sessionRecord";
import { readJson, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "sessions.json";

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

  const rows = await readJson<SessionRecord[]>(FILE, []);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const original = rows[idx];
  if (newDuration > original.durationSec) {
    return NextResponse.json(
      { error: "cannot extend a session — only trimming is allowed" },
      { status: 400 },
    );
  }
  const updated: SessionRecord = { ...original, durationSec: newDuration };
  rows[idx] = updated;
  await writeJsonAtomic(FILE, rows);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = params.id;
  const rows = await readJson<SessionRecord[]>(FILE, []);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const removed = rows[idx];
  rows.splice(idx, 1);
  await writeJsonAtomic(FILE, rows);
  return NextResponse.json(removed);
}
