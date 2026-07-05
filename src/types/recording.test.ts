import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LatestRecording type", () => {
  const source = readFileSync(new URL("./recording.ts", import.meta.url), "utf8");

  it("keys recordings by item kind, item id, and session id", () => {
    expect(source).toContain("itemKind");
    expect(source).toContain("itemId");
    expect(source).toContain("sessionId");
    expect(source).not.toContain("songId");
  });
});
