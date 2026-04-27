import { describe, it, expect } from "vitest";
import { exerciseAsSong } from "./exerciseAdapter";
import type { Exercise } from "@/types/exercise";

const e: Exercise = {
  id: "e1",
  name: "Alternate picking",
  link: "https://example.com",
  notes: "rest stroke",
  workingBpm: 120,
  warmupBpm: null,
  stepPercent: 2.5,
  sessionMinutes: 5,
  openEnded: false,
  metronomeEnabled: true,
  practiceMode: "smart",
  includeWarmupBlock: true,
  totalPracticeSec: 42,
  sortIndex: 3,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

describe("exerciseAsSong", () => {
  it("maps name → title and preserves identity fields", () => {
    const s = exerciseAsSong(e);
    expect(s.id).toBe("e1");
    expect(s.title).toBe("Alternate picking");
    expect(s.link).toBe("https://example.com");
    expect(s.workingBpm).toBe(120);
    expect(s.stepPercent).toBe(2.5);
    expect(s.totalPracticeSec).toBe(42);
    expect(s.sortIndex).toBe(3);
    expect(s.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(s.updatedAt).toBe("2026-01-02T00:00:00Z");
  });

  it("produces a song with no trouble spots and no original BPM", () => {
    const s = exerciseAsSong(e);
    expect(s.troubleSpots).toEqual([]);
    expect(s.originalBpm).toBeNull();
  });
});
