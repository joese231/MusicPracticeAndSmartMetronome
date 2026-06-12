import { NextResponse } from "next/server";
import {
  validateSong,
} from "@/lib/api/validation";
import type { Song } from "@/types/song";
import { readJson, updateJsonAtomic, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "songs.json";

export async function GET() {
  const rows = await readJson<Song[]>(FILE, []);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const validation = validateSong(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  return updateJsonAtomic(FILE, [] as Song[], (rows) => {
    const next = rows.filter((row) => row.id !== validation.value.id);
    next.push(validation.value);
    return { value: next, result: NextResponse.json({ ok: true }) };
  });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as unknown;
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }
  for (const row of body) {
    const validation = validateSong(row);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }
  await writeJsonAtomic(FILE, body as Song[]);
  return NextResponse.json({ ok: true });
}
