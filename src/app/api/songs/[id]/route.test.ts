import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SONG_BLOCK_TEMPLATE, type Song } from "@/types/song";
import { PATCH } from "./route";

let songs: Song[] = [];

vi.mock("@/lib/db/fileStore", () => ({
  updateJsonAtomic: vi.fn(async (_file, fallback, mutator) => {
    const { value, result } = await mutator(songs.length ? songs : fallback);
    songs = value;
    return result;
  }),
}));

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    title: "Blackberry Blossom",
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
    totalPracticeSec: 600,
    sortIndex: 0,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("song item API", () => {
  beforeEach(() => {
    songs = [makeSong()];
  });

  it("rejects patches that try to overwrite practice totals", async () => {
    const res = await PATCH(
      new Request("http://test/api/songs/song-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
          patch: {
            title: "New title",
            totalPracticeSec: 0,
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: { id: "song-1" } },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "song patch field totalPracticeSec is not editable here",
    });
  });

  it("rejects stale patches when updatedAt changed", async () => {
    const res = await PATCH(
      new Request("http://test/api/songs/song-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-11T23:59:00.000Z",
          patch: {
            title: "Stale title",
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: { id: "song-1" } },
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "song was modified by another write",
    });
  });

  it("updates editable fields without changing practice totals", async () => {
    const res = await PATCH(
      new Request("http://test/api/songs/song-1", {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
          patch: {
            title: "Edited",
            updatedAt: "2026-06-12T00:01:00.000Z",
          },
        }),
      }),
      { params: { id: "song-1" } },
    );

    expect(res.status).toBe(200);
    expect(songs[0]).toMatchObject({
      id: "song-1",
      title: "Edited",
      totalPracticeSec: 600,
    });
  });
});
