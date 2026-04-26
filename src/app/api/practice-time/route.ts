import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "practice-time.json");

type PracticeTimeMap = Record<string, number>;

async function readMap(): Promise<PracticeTimeMap> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PracticeTimeMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.round(v);
      }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeMap(map: PracticeTimeMap): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(map, null, 2) + "\n", "utf8");
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
    const map = await readMap();
    const next = Math.max(map[id] ?? 0, Math.round(totalPracticeSec));
    map[id] = next;
    await writeMap(map);
    return NextResponse.json({ id, totalPracticeSec: next });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
