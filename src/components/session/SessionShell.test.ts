import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SessionShell", () => {
  it("uses a mobile-safe viewport root and wrapping toolbar", () => {
    const source = readFileSync(
      new URL("./SessionShell.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("min-h-dvh");
    expect(source).toContain("overflow-x-hidden");
    expect(source).toContain("flex flex-wrap items-start justify-between");
  });
});
