import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ExerciseDetailPage layout", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  it("puts the current mode and start-session controls before history", () => {
    const modeIndex = source.indexOf('label="Mode"');
    const startIndex = source.indexOf("Start session");
    const recordingIndex = source.indexOf("<LatestRecordingPanel");
    const chartIndex = source.indexOf("<BpmTimelineChart");

    expect(modeIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(-1);
    expect(recordingIndex).toBeGreaterThan(-1);
    expect(chartIndex).toBeGreaterThan(-1);
    expect(modeIndex).toBeLessThan(recordingIndex);
    expect(startIndex).toBeLessThan(recordingIndex);
    expect(startIndex).toBeLessThan(chartIndex);
  });
});
