import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SessionRecord } from "@/types/sessionRecord";
import type { Song } from "@/types/song";

const originalCwd = process.cwd();

async function loadRouteInTempDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gsm-complete-"));
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
    totalPracticeSec: 40,
    sortIndex: 0,
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z",
  };
}

function makeRecord(id: string): SessionRecord {
  return {
    id,
    itemId: "song-1",
    itemKind: "song",
    itemTitle: "Test song",
    startedAt: "2026-06-11T12:00:00.000Z",
    endedAt: "2026-06-11T12:05:00.000Z",
    durationSec: 300,
    endedReason: "complete",
    plannedMinutes: 5,
    startWorkingBpm: 100,
    endWorkingBpm: 100,
    startTroubleBpms: [],
    endTroubleBpms: [],
    promotions: [],
  };
}

describe("complete session API", () => {
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

  it("appends the session and increments the latest item total in one request", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong()], null, 2),
    );

    const res = await POST(
      new Request("http://localhost/api/sessions/complete", {
        method: "POST",
        body: JSON.stringify({ record: makeRecord("session-1") }),
      }),
    );

    expect(res.status).toBe(200);
    const sessions = JSON.parse(
      await readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ) as SessionRecord[];
    const songs = JSON.parse(
      await readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ) as Song[];
    expect(sessions.map((session) => session.id)).toEqual(["session-1"]);
    expect(songs[0].totalPracticeSec).toBe(340);
  });

  it("dedupes repeated completion requests without double-incrementing totals", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong()], null, 2),
    );
    const body = JSON.stringify({ record: makeRecord("session-1") });

    await POST(
      new Request("http://localhost/api/sessions/complete", { method: "POST", body }),
    );
    await POST(
      new Request("http://localhost/api/sessions/complete", { method: "POST", body }),
    );

    const sessions = JSON.parse(
      await readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ) as SessionRecord[];
    const songs = JSON.parse(
      await readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ) as Song[];
    expect(sessions).toHaveLength(1);
    expect(songs[0].totalPracticeSec).toBe(340);
  });

  it("reconciles a pending duplicate completion by applying a missing item total increment", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "songs.json"),
      JSON.stringify([makeSong()], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "sessions.json"),
      JSON.stringify([makeRecord("session-1")], null, 2),
    );
    await writeFile(
      path.join(tempDir, "data", "session-completion-ledger.json"),
      JSON.stringify({ "session-1": "pending" }, null, 2),
    );

    const res = await POST(
      new Request("http://localhost/api/sessions/complete", {
        method: "POST",
        body: JSON.stringify({ record: makeRecord("session-1") }),
      }),
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
    expect(sessions).toHaveLength(1);
    expect(songs[0].totalPracticeSec).toBe(340);
    expect(ledger["session-1"]).toBe("applied");
  });

  it("rejects free-play records on the item-completion endpoint", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;

    const res = await POST(
      new Request("http://localhost/api/sessions/complete", {
        method: "POST",
        body: JSON.stringify({
          record: {
            ...makeRecord("free-session"),
            itemId: "__freeplay__",
            itemKind: "freePlay",
          },
        }),
      }),
    );

    expect(res.status).toBe(400);
  });
});
