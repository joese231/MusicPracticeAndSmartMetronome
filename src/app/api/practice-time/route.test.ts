import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Song } from "@/types/song";

const originalCwd = process.cwd();

async function loadRouteInTempDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gsm-practice-time-"));
  process.chdir(dir);
  vi.resetModules();
  await mkdir(path.join(dir, "data"), { recursive: true });
  const route = await import("./route");
  return { dir, route };
}

function makeSong(): Song {
  return {
    id: "song-1",
    title: "Test song",
    link: null,
    workingBpm: 100,
    warmupBpm: null,
    troubleSpots: [],
    originalBpm: null,
    stepPercent: 2.5,
    practiceMode: "smart",
    includeWarmupBlock: true,
    defaultSessionMinutes: 5,
    metronomeEnabled: true,
    totalPracticeSec: 100,
    sortIndex: 0,
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z",
  };
}

describe("practice-time API", () => {
  let tempDir: string | null = null;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.resetModules();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("applies song total deltas against the latest saved row", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { PATCH } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong()], null, 2),
    );

    const res = await PATCH(
      new Request("http://localhost/api/practice-time", {
        method: "PATCH",
        body: JSON.stringify({
          itemKind: "song",
          itemId: "song-1",
          deltaSec: -20,
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalPracticeSec: 80 });
    const songs = JSON.parse(
      await readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ) as Song[];
    const mirror = JSON.parse(
      await readFile(path.join(tempDir, "data", "practice-time.json"), "utf8"),
    ) as Record<string, number>;
    expect(songs[0].totalPracticeSec).toBe(80);
    expect(mirror["song-1"]).toBe(80);
  });
});
