import { NextResponse } from "next/server";
import type { Exercise } from "@/types/exercise";
import { readJson, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "exercises.json";

export async function GET() {
  const rows = await readJson<Exercise[]>(FILE, []);
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Exercise[];
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }
  await writeJsonAtomic(FILE, body);
  return NextResponse.json({ ok: true });
}
