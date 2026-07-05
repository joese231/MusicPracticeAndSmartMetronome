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

  it("settles pending exercise writes before completing the session record", () => {
    const source = readFileSync(
      new URL("./[id]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("pendingExerciseWriteRef");
    expect(source).toContain("await pendingExerciseWriteRef.current.catch");
    expect(source).toContain("queueExerciseUpdate(promotedExercise)");
  });

  it("does not expose repeat-after-finalization from the intermission overlay", () => {
    const source = readFileSync(
      new URL("./[id]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("onRepeatLastBlock=");
    expect(source).not.toContain("repeatCurrentBlockFromEnded");
  });

  it("renders a configuration error for invalid block plans", () => {
    const source = readFileSync(
      new URL("./[id]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("buildExerciseBlockPlan");
    expect(source).toContain("!blockPlan.ok");
    expect(source).toContain("Session configuration needs attention");
    expect(source).toContain("Edit exercise");
  });
});
