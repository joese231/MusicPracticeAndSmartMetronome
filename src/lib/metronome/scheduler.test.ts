import { describe, it, expect } from "vitest";
import { recoverFromDrift } from "./scheduler";

const P = 0.5; // 120 BPM = 500ms per beat

describe("recoverFromDrift", () => {
  it("passes through when nextBeatTime is in the future", () => {
    const r = recoverFromDrift(1.05, 1.0, P);
    expect(r.skipped).toBe(false);
    expect(r.nextBeatTime).toBe(1.05);
    expect(r.skippedBeats).toBe(0);
  });

  it("passes through when nextBeatTime is within the grace window", () => {
    // 10ms in the past — under the 20ms threshold, so no recovery.
    const r = recoverFromDrift(0.99, 1.0, P);
    expect(r.skipped).toBe(false);
    expect(r.nextBeatTime).toBe(0.99);
    expect(r.skippedBeats).toBe(0);
  });

  it("re-anchors to the next on-grid position when well in the past", () => {
    // nextBeatTime=0.7, now=1.0, P=0.5. The pre-stall grid would have had
    // beats at 0.7, 1.2, 1.7... Target = now + 0.05 = 1.05. First on-grid
    // position ≥ 1.05 is 1.2, so recovery should land there.
    const r = recoverFromDrift(0.7, 1.0, P);
    expect(r.skipped).toBe(true);
    expect(r.nextBeatTime).toBeCloseTo(1.2, 9);
    expect(r.skippedBeats).toBe(1);
  });

  it("skips multiple whole beats when the stall is long", () => {
    // nextBeatTime=0.5, now=2.0, P=0.5. Grid was 0.5, 1.0, 1.5, 2.0, 2.5...
    // Target = 2.05. First on-grid position ≥ 2.05 is 2.5 → skip 4 beats
    // (to 1.0, 1.5, 2.0, 2.5).
    const r = recoverFromDrift(0.5, 2.0, P);
    expect(r.skipped).toBe(true);
    expect(r.nextBeatTime).toBeCloseTo(2.5, 9);
    expect(r.skippedBeats).toBe(4);
  });

  it("always re-anchors to a slightly-future time", () => {
    const now = 5.0;
    const r = recoverFromDrift(4.0, now, P);
    expect(r.nextBeatTime).toBeGreaterThan(now);
  });

  it("exactly-at-threshold is not treated as drift", () => {
    const r = recoverFromDrift(0.98, 1.0, P);
    expect(r.skipped).toBe(false);
  });
});
