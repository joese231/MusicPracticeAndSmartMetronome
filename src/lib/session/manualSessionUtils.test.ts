import { describe, it, expect } from "vitest";
import { parseDurationToSeconds } from "./manualSessionUtils";

describe("parseDurationToSeconds", () => {
  it("parses minutes only", () => {
    expect(parseDurationToSeconds("25")).toBe(1500);
  });

  it("parses minutes with m suffix", () => {
    expect(parseDurationToSeconds("25m")).toBe(1500);
  });

  it("parses minutes and seconds", () => {
    expect(parseDurationToSeconds("25m 30s")).toBe(1530);
  });

  it("parses seconds only", () => {
    expect(parseDurationToSeconds("90s")).toBe(90);
  });

  it("parses total seconds without suffix", () => {
    expect(parseDurationToSeconds("1530")).toBe(1530);
  });

  it("handles whitespace", () => {
    expect(parseDurationToSeconds("  25m  30s  ")).toBe(1530);
  });

  it("throws on invalid input", () => {
    expect(() => parseDurationToSeconds("invalid")).toThrow();
    expect(() => parseDurationToSeconds("")).toThrow();
  });
});
