import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ExerciseSessionPage wiring", () => {
  it("routes shared session completion through the real endSession callback", () => {
    const source = readFileSync(
      new URL("./[id]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(/endSessionRef\.current\s*=\s*\(reason\)\s*=>/);
    expect(source).toContain("void endSession(reason)");
  });
});
