import { NextResponse } from "next/server";
import type { Song, Settings } from "@/types/song";
import type { Exercise } from "@/types/exercise";
import { readJson, writeJsonAtomic } from "@/lib/db/fileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MigratePayload = {
  songs?: Song[];
  exercises?: Exercise[];
  settings?: Settings;
};

export async function POST(req: Request) {
  const body = (await req.json()) as MigratePayload;
  const result: { songs: number; exercises: number; settings: boolean } = {
    songs: 0,
    exercises: 0,
    settings: false,
  };

  if (Array.isArray(body.songs) && body.songs.length > 0) {
    const existing = await readJson<Song[]>("songs.json", []);
    if (existing.length === 0) {
      await writeJsonAtomic("songs.json", body.songs);
      result.songs = body.songs.length;
    }
  }

  if (Array.isArray(body.exercises) && body.exercises.length > 0) {
    const existing = await readJson<Exercise[]>("exercises.json", []);
    if (existing.length === 0) {
      await writeJsonAtomic("exercises.json", body.exercises);
      result.exercises = body.exercises.length;
    }
  }

  if (body.settings) {
    const existing = await readJson<Settings | null>("settings.json", null);
    if (!existing) {
      await writeJsonAtomic("settings.json", body.settings);
      result.settings = true;
    }
  }

  return NextResponse.json(result);
}
