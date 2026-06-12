import { NextResponse } from "next/server";
import type { SessionRecord } from "@/types/sessionRecord";
import { readJson, updateJsonAtomic, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "sessions.json";

export async function GET() {
  const rows = await readJson<SessionRecord[]>(FILE, []);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "expected object" }, { status: 400 });
  }
  const rec = body as SessionRecord;
  if (typeof rec.id !== "string" || typeof rec.itemId !== "string") {
    return NextResponse.json({ error: "invalid record" }, { status: 400 });
  }
  const result = await updateJsonAtomic<SessionRecord[], { deduped: boolean }>(
    FILE,
    [],
    (rows) => {
      if (rows.some((r) => r.id === rec.id)) {
        return { value: rows, result: { deduped: true } };
      }
      return { value: [...rows, rec], result: { deduped: false } };
    },
  );
  return NextResponse.json(
    result.deduped ? { ok: true, deduped: true } : { ok: true },
  );
}

// Replace the entire array. Used by the "Reset all statistics" and "Factory
// reset" actions in Settings to clear session history.
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }
  await writeJsonAtomic(FILE, body);
  return NextResponse.json({ ok: true });
}
