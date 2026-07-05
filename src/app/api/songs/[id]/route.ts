import { NextResponse } from "next/server";
import { validateSong, validateSongPatch } from "@/lib/api/validation";
import { updateJsonAtomic } from "@/lib/db/fileStore";
import type { Song } from "@/types/song";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "songs.json";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  const { id } = await params;
  const body = (await req.json()) as unknown;
  const request = validateSongPatch(body);
  if (!request.ok) {
    return NextResponse.json({ error: request.error }, { status: 400 });
  }

  return updateJsonAtomic<Song[], Response>(FILE, [] as Song[], (rows) => {
    const idx = rows.findIndex((row) => row.id === id);
    if (idx < 0) {
      return {
        value: rows,
        result: NextResponse.json({ error: "song not found" }, { status: 404 }),
      };
    }

    const current = rows[idx];
    if (
      request.value.expectedUpdatedAt &&
      current.updatedAt !== request.value.expectedUpdatedAt
    ) {
      return {
        value: rows,
        result: NextResponse.json(
          { error: "song was modified by another write" },
          { status: 409 },
        ),
      };
    }

    const next = { ...current, ...request.value.patch, id: current.id };
    const validated = validateSong(next);
    if (!validated.ok) {
      return {
        value: rows,
        result: NextResponse.json({ error: validated.error }, { status: 400 }),
      };
    }

    const out = [...rows];
    out[idx] = validated.value;
    return { value: out, result: NextResponse.json(validated.value) };
  });
}

export async function DELETE(_req: Request, { params }: Context) {
  const { id } = await params;
  await updateJsonAtomic(FILE, [] as Song[], (rows) => ({
    value: rows.filter((row) => row.id !== id),
    result: undefined,
  }));
  return NextResponse.json({ ok: true });
}
