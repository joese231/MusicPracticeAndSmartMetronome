import { describe, expect, it } from "vitest";
import { nextSegmentedValue } from "./SegmentedControl";

describe("nextSegmentedValue", () => {
  const options = [
    { value: "smart", label: "Smart" },
    { value: "simple", label: "Simple" },
    { value: "timed", label: "Timed" },
  ] as const;

  it("moves right from the active value", () => {
    expect(nextSegmentedValue(options, "smart", 1)).toBe("simple");
  });

  it("wraps left from the first value", () => {
    expect(nextSegmentedValue(options, "smart", -1)).toBe("timed");
  });

  it("starts from the first option when the current value is missing", () => {
    expect(nextSegmentedValue(options, "missing", 1)).toBe("simple");
  });
});
