import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";

const originalCwd = process.cwd();

async function loadRouteInTempDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gsm-session-id-"));
  process.chdir(dir);
  vi.resetModules();
  await mkdir(path.join(dir, "data"), { recursive: true });
  const route = await import("./route");
  return { dir, route };
}

function makeSong(totalPracticeSec = 400): Song {
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
    totalPracticeSec,
    sortIndex: 0,
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z",
  };
}

function makeRecord(id: string, durationSec = 300): SessionRecord {
  return {
    id,
    itemId: "song-1",
    itemKind: "song",
    itemTitle: "Test song",
    startedAt: "2026-06-11T12:00:00.000Z",
    endedAt: "2026-06-11T12:05:00.000Z",
    durationSec,
    endedReason: "complete",
    plannedMinutes: 5,
    startWorkingBpm: 100,
    endWorkingBpm: 100,
    startTroubleBpms: [],
    endTroubleBpms: [],
    promotions: [],
  };
}

describe("session record item route", () => {
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

  it("trims a song session and rolls back the item total server-side", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { PATCH } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "sessions.json"),
      JSON.stringify([makeRecord("session-1", 300)], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong(400)], null, 2),
    );

    const res = await PATCH(
      new Request("http://localhost/api/sessions/session-1", {
        method: "PATCH",
        body: JSON.stringify({ durationSec: 180 }),
      }),
      { params: Promise.resolve({ id: "session-1" }) },
    );

    expect(res.status).toBe(200);
    const sessions = JSON.parse(
      await readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ) as SessionRecord[];
    const songs = JSON.parse(
      await readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ) as Song[];
    const mirror = JSON.parse(
      await readFile(path.join(tempDir, "data", "practice-time.json"), "utf8"),
    ) as Record<string, number>;
    expect(sessions[0].durationSec).toBe(180);
    expect(songs[0].totalPracticeSec).toBe(280);
    expect(mirror["song-1"]).toBe(280);
  });

  it("deletes a song session and rolls back the item total server-side", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { DELETE } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "sessions.json"),
      JSON.stringify([makeRecord("session-1", 300)], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong(400)], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "session-completion-ledger.json"),
      JSON.stringify({ "session-1": "applied" }, null, 2),
    );

    const res = await DELETE(
      new Request("http://localhost/api/sessions/session-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "session-1" }) },
    );

    expect(res.status).toBe(200);
    const sessions = JSON.parse(
      await readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ) as SessionRecord[];
    const songs = JSON.parse(
      await readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ) as Song[];
    const ledger = JSON.parse(
      await readFile(
        path.join(tempDir, "data", "session-completion-ledger.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    expect(sessions).toEqual([]);
    expect(songs[0].totalPracticeSec).toBe(100);
    expect(ledger["session-1"]).toBeUndefined();
  });
});
