import { NextResponse } from "next/server";
import { validateSettings, validateSettingsPatch } from "@/lib/api/validation";
import type { Settings } from "@/types/song";
import { DEFAULT_SETTINGS } from "@/types/song";
import { readJson, updateJsonAtomic, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "settings.json";

export async function GET() {
  const stored = await readJson<Partial<Settings> | null>(FILE, null);
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  return NextResponse.json(merged);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as unknown;
  const validation = validateSettings(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  await writeJsonAtomic(FILE, validation.value);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as unknown;
  const patch = validateSettingsPatch(body);
  if (!patch.ok) {
    return NextResponse.json({ error: patch.error }, { status: 400 });
  }

  return updateJsonAtomic<Partial<Settings> | null, Response>(
    FILE,
    null,
    (stored) => {
    const next = { ...DEFAULT_SETTINGS, ...(stored ?? {}), ...patch.value };
    const validation = validateSettings(next);
    if (!validation.ok) {
      return {
        value: stored,
        result: NextResponse.json({ error: validation.error }, { status: 400 }),
      };
    }
    return {
      value: validation.value,
      result: NextResponse.json({ ok: true }),
    };
    },
  );
}
