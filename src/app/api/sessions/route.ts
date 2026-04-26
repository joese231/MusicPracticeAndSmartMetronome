import { NextResponse } from "next/server";
import type { SessionRecord } from "@/types/sessionRecord";
import { readJson, writeJsonAtomic } from "@/lib/db/fileStore";

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
  const rows = await readJson<SessionRecord[]>(FILE, []);
  if (rows.some((r) => r.id === rec.id)) {
    return NextResponse.json({ ok: true, deduped: true });
  }
  rows.push(rec);
  await writeJsonAtomic(FILE, rows);
  return NextResponse.json({ ok: true });
}
