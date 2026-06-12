import { NextResponse } from "next/server";
import { updateJsonAtomic } from "@/lib/db/fileStore";
import type { Song } from "@/types/song";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "songs.json";

function parseOrderedIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const orderedIds = (body as { orderedIds?: unknown }).orderedIds;
  if (
    !Array.isArray(orderedIds) ||
    !orderedIds.every((id) => typeof id === "string")
  ) {
    return null;
  }
  return orderedIds;
}

export async function PATCH(req: Request) {
  const orderedIds = parseOrderedIds(await req.json());
  if (!orderedIds) {
    return NextResponse.json(
      { error: "orderedIds must be an array of strings" },
      { status: 400 },
    );
  }

  await updateJsonAtomic(FILE, [] as Song[], (rows) => {
    const index = new Map(orderedIds.map((id, i) => [id, i]));
    return {
      value: rows.map((row) =>
        index.has(row.id) ? { ...row, sortIndex: index.get(row.id)! } : row,
      ),
      result: undefined,
    };
  });
  return NextResponse.json({ ok: true });
}
