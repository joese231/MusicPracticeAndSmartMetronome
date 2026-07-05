import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const originalCwd = process.cwd();

async function loadRouteInTempDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gsm-factory-reset-"));
  process.chdir(dir);
  vi.resetModules();
  await mkdir(path.join(dir, "data"), { recursive: true });
  const route = await import("./route");
  return { dir, route };
}

describe("factory reset API", () => {
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

  it("clears item collections, history, mirrors, and completion ledger server-side", async () => {
    const loaded = await loadRouteInTempDataDir();
    tempDir = loaded.dir;
    const { POST } = loaded.route;
    await writeFile(path.join(tempDir, "data", "songs.json"), "[{}]");
    await writeFile(path.join(tempDir, "data", "exercises.json"), "[{}]");
    await writeFile(path.join(tempDir, "data", "sessions.json"), "[{}]");
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
    await expect(
      readFile(path.join(tempDir, "data", "songs.json"), "utf8"),
    ).resolves.toBe("[]");
    await expect(
      readFile(path.join(tempDir, "data", "exercises.json"), "utf8"),
    ).resolves.toBe("[]");
    await expect(
      readFile(path.join(tempDir, "data", "sessions.json"), "utf8"),
    ).resolves.toBe("[]");
    await expect(
      readFile(path.join(tempDir, "data", "practice-time.json"), "utf8"),
    ).resolves.toBe("{}");
    await expect(
      readFile(
        path.join(tempDir, "data", "session-completion-ledger.json"),
        "utf8",
      ),
    ).resolves.toBe("{}");
  });
});
