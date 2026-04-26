import { NextResponse } from "next/server";
import type { Song } from "@/types/song";
import { readJson, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "songs.json";

export async function GET() {
  const rows = await readJson<Song[]>(FILE, []);
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Song[];
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }
  await writeJsonAtomic(FILE, body);
  return NextResponse.json({ ok: true });
}
