import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readJson, updateJsonAtomic } from "./fileStore";

const testFile = "file-store-lock-test.json";
const testPath = path.join(process.cwd(), "data", testFile);

describe("fileStore locking", () => {
  afterEach(async () => {
    await fs.rm(testPath, { force: true });
  });

  it("allows later atomic updates after a mutator rejects", async () => {
    await expect(
      updateJsonAtomic(testFile, { count: 0 }, async () => {
        throw new Error("expected failure");
      }),
    ).rejects.toThrow("expected failure");

    const result = await updateJsonAtomic(testFile, { count: 0 }, (current) => ({
      value: { count: current.count + 1 },
      result: current.count + 1,
    }));

    await expect(readJson(testFile, { count: 0 })).resolves.toEqual({ count: 1 });
    expect(result).toBe(1);
  });
});
