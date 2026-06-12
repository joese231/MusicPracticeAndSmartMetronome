import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SONG_BLOCK_TEMPLATE, type Song } from "@/types/song";
import { POST, PUT } from "./route";

let written: unknown = null;

vi.mock("@/lib/db/fileStore", () => ({
  readJson: vi.fn(async (_file, fallback) => fallback),
  updateJsonAtomic: vi.fn(async (_file, fallback, mutator) => {
    const { value, result } = await mutator(
      Array.isArray(written) ? written : fallback,
    );
    written = value;
    return result;
  }),
  writeJsonAtomic: vi.fn(async (_file, value) => {
    written = value;
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
    totalPracticeSec: 0,
    sortIndex: 0,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("songs API validation", () => {
  beforeEach(() => {
    written = null;
  });

  it("validates song creates", async () => {
    const res = await POST(
      new Request("http://test/api/songs", {
        method: "POST",
        body: JSON.stringify(makeSong()),
      }),
    );

    expect(res.status).toBe(200);
    expect(written).toEqual([makeSong()]);
  });

  it("rejects malformed song creates", async () => {
    const res = await POST(
      new Request("http://test/api/songs", {
        method: "POST",
        body: JSON.stringify(makeSong({ title: "" })),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "song.title must be a non-empty string",
    });
  });

  it("validates legacy bulk replacement rows", async () => {
    const res = await PUT(
      new Request("http://test/api/songs", {
        method: "PUT",
        body: JSON.stringify([makeSong(), makeSong({ id: "song-2", title: "" })]),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "song.title must be a non-empty string",
    });
  });
});
