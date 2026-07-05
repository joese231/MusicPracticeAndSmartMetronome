import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SessionRecord } from "@/types/sessionRecord";

const originalCwd = process.cwd();

async function loadRouteInTempDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gsm-sessions-"));
  process.chdir(dir);
  vi.resetModules();
  await mkdir(path.join(dir, "data"), { recursive: true });
  const route = await import("./route");
  return { dir, route };
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

describe("sessions API persistence", () => {
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

  it("preserves every record when appends arrive concurrently", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;

    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        POST(
          new Request("http://localhost/api/sessions", {
            method: "POST",
            body: JSON.stringify(makeRecord(`session-${i}`)),
          }),
        ),
      ),
    );

    const raw = await readFile(
      path.join(tempDir, "data", "sessions.json"),
      "utf8",
    );
    const rows = JSON.parse(raw) as SessionRecord[];
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((row) => row.id)).size).toBe(12);
  });

  it("rejects malformed session records instead of appending partial rows", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;

    const res = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          id: "bad-session",
          itemId: "song-1",
          itemKind: "song",
          durationSec: -30,
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(
      readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("validates bulk replacement and clears the completion ledger on reset", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { PUT } = loaded.route;
    await writeFile(
      path.join(tempDir, "data", "session-completion-ledger.json"),
      JSON.stringify({ "session-1": "applied" }, null, 2),
    );

    const invalid = await PUT(
      new Request("http://localhost/api/sessions", {
        method: "PUT",
        body: JSON.stringify([{ ...makeRecord("session-1"), promotions: "bad" }]),
      }),
    );
    expect(invalid.status).toBe(400);

    const reset = await PUT(
      new Request("http://localhost/api/sessions", {
        method: "PUT",
        body: JSON.stringify([]),
      }),
    );

    expect(reset.status).toBe(200);
    const ledger = JSON.parse(
      await readFile(
        path.join(tempDir, "data", "session-completion-ledger.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    expect(ledger).toEqual({});
  });
});
