import { NextResponse } from "next/server";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";
import { updateJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await updateJsonAtomic<Song[], null>("songs.json", [], () => ({
    value: [],
    result: null,
  }));
  await updateJsonAtomic<Exercise[], null>("exercises.json", [], () => ({
    value: [],
    result: null,
  }));
  await updateJsonAtomic<SessionRecord[], null>("sessions.json", [], () => ({
    value: [],
    result: null,
  }));
  await updateJsonAtomic<Record<string, number>, null>(
    "practice-time.json",
    {},
    () => ({
      value: {},
      result: null,
    }),
  );
  await updateJsonAtomic<Record<string, "pending" | "applied">, null>(
    "session-completion-ledger.json",
    {},
    () => ({
      value: {},
      result: null,
    }),
  );

  return NextResponse.json({ ok: true });
}
