import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "@/lib/db/repository";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SONG_BLOCK_TEMPLATE,
  type Song,
} from "@/types/song";
import { useSongsStore } from "./useSongsStore";
import { useSettingsStore } from "./useSettingsStore";

const repo: Partial<Repository> = {};

vi.mock("@/lib/db/localRepository", () => ({
  getRepository: () => repo,
}));

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    title: "Local",
    link: null,
    workingBpm: 90,
    warmupBpm: null,
    troubleSpots: [],
    originalBpm: null,
    stepPercent: 2.5,
    practiceMode: "smart",
    includeWarmupBlock: true,
    blockTemplate: DEFAULT_SONG_BLOCK_TEMPLATE,
    defaultSessionMinutes: 10,
    metronomeEnabled: true,
    totalPracticeSec: 0,
    sortIndex: 0,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("useSongsStore persistence recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(repo) as Array<keyof Repository>) {
      delete repo[key];
    }
    useSongsStore.setState({ songs: [], loaded: false });
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, loaded: true });
    global.fetch = vi.fn(async () => Response.json({})) as typeof fetch;
  });

  it("reloads songs when an update hits optimistic concurrency", async () => {
    const serverSong = makeSong({ title: "Server" });
    repo.upsertSong = vi.fn(async () => {
      throw new Error("PATCH /api/songs/song-1 failed: 409");
    });
    repo.listSongs = vi.fn(async () => [serverSong]);
    useSongsStore.setState({ songs: [makeSong()], loaded: true });

    await expect(
      useSongsStore.getState().updateSong(makeSong({ title: "Edited" })),
    ).rejects.toThrow("409");

    expect(repo.listSongs).toHaveBeenCalled();
    expect(useSongsStore.getState().songs).toEqual([serverSong]);
  });

  it("creates new songs at the top of the manual order", async () => {
    repo.upsertSong = vi.fn(async () => {});
    useSongsStore.setState({
      songs: [
        makeSong({ id: "song-1", sortIndex: 0, title: "First" }),
        makeSong({ id: "song-2", sortIndex: 1, title: "Second" }),
      ],
      loaded: true,
    });

    const created = await useSongsStore.getState().createSong({
      title: "Newest",
      link: null,
      workingBpm: 120,
      troubleSpots: [],
      originalBpm: null,
    });

    expect(created.sortIndex).toBe(-1);
    expect(repo.upsertSong).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id, sortIndex: -1 }),
    );
    expect(useSongsStore.getState().songs.map((s) => s.id)).toEqual([
      created.id,
      "song-1",
      "song-2",
    ]);
  });
});
