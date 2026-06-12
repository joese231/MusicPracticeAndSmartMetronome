import { NextResponse } from "next/server";
import { readJson, updateJsonAtomic, writeJsonAtomic } from "@/lib/db/fileStore";
import type { Exercise } from "@/types/exercise";
import type { Song } from "@/types/song";
import { nowIso } from "@/lib/session/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "practice-time.json";

type PracticeTimeMap = Record<string, number>;

function sanitizeMap(value: unknown): PracticeTimeMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: PracticeTimeMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = Math.round(v);
    }
  }
  return out;
}

async function readMap(): Promise<PracticeTimeMap> {
  return sanitizeMap(await readJson<unknown>(FILE, {}));
}

export async function GET() {
  try {
    const map = await readMap();
    return NextResponse.json(map);
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { id, totalPracticeSec } = body as {
    id?: unknown;
    totalPracticeSec?: unknown;
  };
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  if (
    typeof totalPracticeSec !== "number" ||
    !Number.isFinite(totalPracticeSec) ||
    totalPracticeSec < 0
  ) {
    return NextResponse.json({ error: "invalid totalPracticeSec" }, { status: 400 });
  }

  try {
    const next = await updateJsonAtomic<unknown, number>(FILE, {}, (stored) => {
      const map = sanitizeMap(stored);
      const next = Math.max(map[id] ?? 0, Math.round(totalPracticeSec));
      map[id] = next;
      return { value: map, result: next };
    });
    return NextResponse.json({ id, totalPracticeSec: next });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { itemKind, itemId, deltaSec } = body as {
    itemKind?: unknown;
    itemId?: unknown;
    deltaSec?: unknown;
  };
  if (itemKind !== "song" && itemKind !== "exercise") {
    return NextResponse.json({ error: "invalid itemKind" }, { status: 400 });
  }
  if (typeof itemId !== "string" || itemId.length === 0) {
    return NextResponse.json({ error: "invalid itemId" }, { status: 400 });
  }
  if (typeof deltaSec !== "number" || !Number.isFinite(deltaSec)) {
    return NextResponse.json({ error: "invalid deltaSec" }, { status: 400 });
  }

  const file = itemKind === "song" ? "songs.json" : "exercises.json";
  try {
    const totalPracticeSec =
      itemKind === "song"
        ? await updateJsonAtomic<Song[], number>(file, [], (rows) => {
            const idx = rows.findIndex((row) => row.id === itemId);
            if (idx < 0) throw new Error("not-found");
            const next = rows.slice();
            const totalPracticeSec = Math.max(
              0,
              next[idx].totalPracticeSec + Math.round(deltaSec),
            );
            next[idx] = { ...next[idx], totalPracticeSec, updatedAt: nowIso() };
            return { value: next, result: totalPracticeSec };
          })
        : await updateJsonAtomic<Exercise[], number>(file, [], (rows) => {
            const idx = rows.findIndex((row) => row.id === itemId);
            if (idx < 0) throw new Error("not-found");
            const next = rows.slice();
            const totalPracticeSec = Math.max(
              0,
              next[idx].totalPracticeSec + Math.round(deltaSec),
            );
            next[idx] = { ...next[idx], totalPracticeSec, updatedAt: nowIso() };
            return { value: next, result: totalPracticeSec };
          });

    if (itemKind === "song") {
      await updateJsonAtomic<unknown, null>(FILE, {}, (stored) => {
        const map = sanitizeMap(stored);
        return {
          value: { ...map, [itemId]: totalPracticeSec },
          result: null,
        };
      });
    }

    return NextResponse.json({ itemKind, itemId, totalPracticeSec });
  } catch (err) {
    if (err instanceof Error && err.message === "not-found") {
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE() {
  try {
    await writeJsonAtomic(FILE, {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
