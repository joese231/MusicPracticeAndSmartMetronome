import { NextResponse } from "next/server";
import { validateExercise } from "@/lib/api/validation";
import type { Exercise } from "@/types/exercise";
import { readJson, updateJsonAtomic, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "exercises.json";

export async function GET() {
  const rows = await readJson<Exercise[]>(FILE, []);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const validation = validateExercise(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  return updateJsonAtomic(FILE, [] as Exercise[], (rows) => {
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
    const validation = validateExercise(row);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }
  await writeJsonAtomic(FILE, body as Exercise[]);
  return NextResponse.json({ ok: true });
}
