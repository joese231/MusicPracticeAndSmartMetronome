import { create } from "zustand";
import type { Song, TroubleSpot } from "@/types/song";
import { DEFAULT_STEP_PERCENT } from "@/types/song";
import { getRepository } from "@/lib/db/localRepository";
import { nowIso } from "@/lib/session/tempo";

type NewSongInput = {
  title: string;
  link: string | null;
  workingBpm: number;
  troubleSpots: TroubleSpot[];
  originalBpm: number | null;
  stepPercent?: number;
};

type SongsState = {
  songs: Song[];
  loaded: boolean;
  load: () => Promise<void>;
  getById: (id: string) => Song | undefined;
  createSong: (input: NewSongInput) => Promise<Song>;
  updateSong: (song: Song) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  reorderSongs: (orderedIds: string[]) => Promise<void>;
  incrementPracticeTime: (id: string, seconds: number) => Promise<void>;
};

const genId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const useSongsStore = create<SongsState>((set, get) => ({
  songs: [],
  loaded: false,

  load: async () => {
    const songs = await getRepository().listSongs();
    const fileMap = await fetchPracticeTimeMap();
    const reconciled: Song[] = [];
    for (const song of songs) {
      const fileValue = fileMap[song.id];
      if (typeof fileValue === "number" && fileValue > song.totalPracticeSec) {
        const merged: Song = {
          ...song,
          totalPracticeSec: fileValue,
          updatedAt: nowIso(),
        };
        await getRepository().upsertSong(merged);
        reconciled.push(merged);
      } else {
        reconciled.push(song);
      }
    }
    set({ songs: reconciled, loaded: true });
  },

  getById: (id) => get().songs.find((s) => s.id === id),

  createSong: async (input) => {
    const now = nowIso();
    const existing = get().songs;
    const nextSortIndex =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((s) => s.sortIndex)) + 1;
    const song: Song = {
      id: genId(),
      title: input.title.trim(),
      link: input.link?.trim() || null,
      workingBpm: input.workingBpm,
      warmupBpm: null,
      troubleSpots: input.troubleSpots,
      originalBpm: input.originalBpm,
      stepPercent: input.stepPercent ?? DEFAULT_STEP_PERCENT,
      totalPracticeSec: 0,
      sortIndex: nextSortIndex,
      createdAt: now,
      updatedAt: now,
    };
    await getRepository().upsertSong(song);
    // Append to end of list — preserving user's manual order.
    set({ songs: [...existing, song] });
    return song;
  },

  updateSong: async (song) => {
    const updated = { ...song, updatedAt: nowIso() };
    await getRepository().upsertSong(updated);
    // Preserve the current list order — don't re-sort by title.
    set({
      songs: get().songs.map((s) => (s.id === updated.id ? updated : s)),
    });
  },

  deleteSong: async (id) => {
    await getRepository().deleteSong(id);
    set({ songs: get().songs.filter((s) => s.id !== id) });
  },

  reorderSongs: async (orderedIds) => {
    const byId = new Map(get().songs.map((s) => [s.id, s]));
    const next: Song[] = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const song = byId.get(orderedIds[i]);
      if (song) next.push({ ...song, sortIndex: i });
    }
    // Optimistic update first so the UI lands immediately on drop.
    set({ songs: next });
    await getRepository().reorderSongs(orderedIds);
  },

  incrementPracticeTime: async (id, seconds) => {
    const s = get().songs.find((x) => x.id === id);
    if (!s) return;
    const updated: Song = {
      ...s,
      totalPracticeSec: s.totalPracticeSec + Math.round(seconds),
      updatedAt: nowIso(),
    };
    await getRepository().upsertSong(updated);
    set({ songs: get().songs.map((x) => (x.id === id ? updated : x)) });
    void postPracticeTime(id, updated.totalPracticeSec);
  },
}));

async function fetchPracticeTimeMap(): Promise<Record<string, number>> {
  if (typeof fetch === "undefined") return {};
  try {
    const res = await fetch("/api/practice-time", { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.round(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function postPracticeTime(
  id: string,
  totalPracticeSec: number,
): Promise<void> {
  if (typeof fetch === "undefined") return;
  try {
    await fetch("/api/practice-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, totalPracticeSec }),
    });
  } catch {
    // file mirror is best-effort — Dexie remains authoritative in-browser
  }
}
