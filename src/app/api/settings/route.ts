import { NextResponse } from "next/server";
import type { Settings } from "@/types/song";
import { DEFAULT_SETTINGS } from "@/types/song";
import { readJson, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "settings.json";

export async function GET() {
  const stored = await readJson<Partial<Settings> | null>(FILE, null);
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  return NextResponse.json(merged);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Settings;
  await writeJsonAtomic(FILE, body);
  return NextResponse.json({ ok: true });
}
