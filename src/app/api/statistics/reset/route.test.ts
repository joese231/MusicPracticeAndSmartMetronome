import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Exercise } from "@/types/exercise";
import type { SessionRecord } from "@/types/sessionRecord";
import { DEFAULT_SETTINGS, type Song } from "@/types/song";

const originalCwd = process.cwd();

async function loadRouteInTempDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gsm-reset-stats-"));
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
    blockTemplate: DEFAULT_SETTINGS.defaultSongBlockTemplate,
    defaultSessionMinutes: 5,
    metronomeEnabled: true,
    totalPracticeSec: 300,
    sortIndex: 0,
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z",
  };
}

function makeExercise(): Exercise {
  return {
    id: "exercise-1",
    name: "Forward roll",
    link: null,
    notes: null,
    workingBpm: 80,
    warmupBpm: null,
    stepPercent: 2.5,
    sessionMinutes: 5,
    openEnded: false,
    metronomeEnabled: true,
    practiceMode: "smart",
    includeWarmupBlock: true,
    blockTemplate: DEFAULT_SETTINGS.defaultExerciseBlockTemplate,
    totalPracticeSec: 200,
    sortIndex: 0,
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z",
  };
}

const session: SessionRecord = {
  id: "session-1",
  itemId: "song-1",
  itemKind: "song",
  itemTitle: "Test song",
  startedAt: "2026-06-11T12:00:00.000Z",
  endedAt: "2026-06-11T12:05:00.000Z",
  durationSec: 300,
  endedReason: "complete",
  plannedMinutes: 5,
  startTroubleBpms: [],
  endTroubleBpms: [],
  promotions: [],
};

describe("statistics reset API", () => {
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

  it("zeros item totals and clears history, mirrors, and completion ledger server-side", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong()], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "exercises.json"),
      JSON.stringify([makeExercise()], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "sessions.json"),
      JSON.stringify([session], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "practice-time.json"),
      JSON.stringify({ "song-1": 300 }, null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "session-completion-ledger.json"),
      JSON.stringify({ "session-1": "applied" }, null, 2),
    );

    const res = await POST();

    expect(res.status).toBe(200);
    const songs = JSON.parse(
      await readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ) as Song[];
    const exercises = JSON.parse(
      await readFile(path.join(tempDir, "data", "exercises.json"), "utf8"),
    ) as Exercise[];
    const sessions = JSON.parse(
      await readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ) as SessionRecord[];
    const mirror = JSON.parse(
      await readFile(path.join(tempDir, "data", "practice-time.json"), "utf8"),
    ) as Record<string, number>;
    const ledger = JSON.parse(
      await readFile(
        path.join(tempDir, "data", "session-completion-ledger.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    expect(songs[0]).toMatchObject({ id: "song-1", totalPracticeSec: 0 });
    expect(exercises[0]).toMatchObject({
      id: "exercise-1",
      totalPracticeSec: 0,
    });
    expect(sessions).toEqual([]);
    expect(mirror).toEqual({});
    expect(ledger).toEqual({});
  });
});
