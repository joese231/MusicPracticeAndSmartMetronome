import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("FreePlayPage copy", () => {
  it("uses action labels for the in-session click toggle", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('metronomeOn ? "Turn click off" : "Turn click on"');
    expect(source).not.toContain('metronomeOn ? "Click on" : "Click off"');
  });
});
