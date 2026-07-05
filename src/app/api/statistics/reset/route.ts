import { NextResponse } from "next/server";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";
import { updateJsonAtomic } from "@/lib/db/fileStore";
import { nowIso } from "@/lib/session/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const updatedAt = nowIso();

  await updateJsonAtomic<Song[], null>("songs.json", [], (songs) => ({
    value: songs.map((song) => ({ ...song, totalPracticeSec: 0, updatedAt })),
    result: null,
  }));
  await updateJsonAtomic<Exercise[], null>(
    "exercises.json",
    [],
    (exercises) => ({
      value: exercises.map((exercise) => ({
        ...exercise,
        totalPracticeSec: 0,
        updatedAt,
      })),
      result: null,
    }),
  );
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
