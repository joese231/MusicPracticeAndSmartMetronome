import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SessionEditModal persistence", () => {
  const source = readFileSync(new URL("./SessionEditModal.tsx", import.meta.url), "utf8");

  it("does not issue client-side practice-time write rollbacks", () => {
    expect(source).not.toContain("adjustPracticeTime");
    expect(source).toContain("loadSongs");
    expect(source).toContain("loadExercises");
  });
});
