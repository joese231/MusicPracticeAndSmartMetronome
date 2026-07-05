import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SessionPage lifecycle wiring", () => {
  const source = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");

  it("settles pending song writes before completing the session record", () => {
    expect(source).toContain("pendingSongWriteRef");
    expect(source).toContain("await pendingSongWriteRef.current.catch");
    expect(source).toContain("queueSongUpdate(promoted)");
  });

  it("renders a configuration error for invalid block plans", () => {
    expect(source).toContain("buildBlockPlan");
    expect(source).toContain("!blockPlan.ok");
    expect(source).toContain("Session configuration needs attention");
    expect(source).toContain("Edit song");
  });
});
