import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BetweenItemsOverlay layout", () => {
  const source = readFileSync(
    new URL("./BetweenItemsOverlay.tsx", import.meta.url),
    "utf8",
  );

  it("wraps inter-item controls vertically on narrow screens", () => {
    expect(source).toContain("flex-col");
    expect(source).toContain("sm:flex-row");
    expect(source).toContain("items-stretch");
  });
});
