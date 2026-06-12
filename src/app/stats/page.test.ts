import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("StatsPage layout", () => {
  it("keeps manual logging collapsed below the stat summary cards", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const manualDetailsIndex = source.indexOf("<ManualLoggingDetails />");
    const statsGridIndex = source.indexOf('className="grid grid-cols-2');

    expect(manualDetailsIndex).toBeGreaterThan(-1);
    expect(statsGridIndex).toBeGreaterThan(-1);
    expect(statsGridIndex).toBeLessThan(manualDetailsIndex);
    expect(source).toContain("<details");
    expect(source).not.toContain("<details open");
  });
});
