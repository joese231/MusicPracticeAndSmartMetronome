import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HomePage navigation", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  it("exposes Free Play from the global header", () => {
    const headerIndex = source.indexOf("<header");
    const navEndIndex = source.indexOf("</nav>", headerIndex);

    expect(headerIndex).toBeGreaterThan(-1);
    expect(navEndIndex).toBeGreaterThan(headerIndex);
    expect(source.slice(headerIndex, navEndIndex)).toContain('href="/free-play"');
  });
});
