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

const makeSong = (id: string, sortIndex: number, title: string): Song => ({
  id,
  title,
  link: null,
  workingBpm: 90,
  warmupBpm: null,
  troubleSpots: [],
  originalBpm: null,
  stepPercent: 2.5,
  practiceMode: "timed",
  includeWarmupBlock: true,
  blockTemplate: DEFAULT_SONG_BLOCK_TEMPLATE,
  defaultSessionMinutes: 10,
  metronomeEnabled: true,
  totalPracticeSec: id === "song-1" ? 600 : 0,
  sortIndex,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
});

describe("song reorder API", () => {
  beforeEach(() => {
    songs = [makeSong("song-1", 0, "A"), makeSong("song-2", 1, "B")];
  });

  it("updates only sortIndex and preserves every other field", async () => {
    const res = await PATCH(
      new Request("http://test/api/songs/reorder", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds: ["song-2", "song-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(songs).toEqual([
      expect.objectContaining({ id: "song-1", sortIndex: 1, totalPracticeSec: 600 }),
      expect.objectContaining({ id: "song-2", sortIndex: 0, totalPracticeSec: 0 }),
    ]);
  });
});
