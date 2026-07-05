import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("usePracticeSession wiring", () => {
  const source = readFileSync(
    new URL("./usePracticeSession.ts", import.meta.url),
    "utf8",
  );

  it("guards the shared advance command while paused", () => {
    const advanceBlock = source.match(
      /const advance = useCallback\(\(\) => \{[\s\S]*?\}, \[blocks\]\);/,
    )?.[0];

    expect(advanceBlock).toContain("if (pausedRef.current) return;");
  });

  it("guards async session start with a generation token", () => {
    expect(source).toContain("startGenerationRef");
    expect(source).toContain("const generation =");
    expect(source).toContain("generation !== startGenerationRef.current");
    expect(source).toContain("rec.cancel()");
  });
});
