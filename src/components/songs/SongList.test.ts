import { describe, expect, it } from "vitest";
import type { Song } from "@/types/song";
import { bpmLabel, moveSongIds } from "./SongList";

const makeSong = (overrides: Partial<Song> = {}): Song => ({
  id: "song-1",
  title: "Blackberry Blossom",
  link: null,
  workingBpm: 120,
  warmupBpm: null,
  troubleSpots: [],
  originalBpm: null,
  stepPercent: 2.5,
  practiceMode: "smart",
  includeWarmupBlock: true,
  defaultSessionMinutes: 10,
  metronomeEnabled: true,
  totalPracticeSec: 0,
  sortIndex: 0,
  createdAt: "2026-06-11T12:00:00.000Z",
  updatedAt: "2026-06-11T12:00:00.000Z",
  ...overrides,
});

describe("bpmLabel", () => {
  it("shows the working BPM when one is saved", () => {
    expect(bpmLabel(makeSong({ workingBpm: 96 }))).toBe("96 BPM");
  });

  it("shows No BPM for no-metronome timed songs without a working BPM", () => {
    expect(
      bpmLabel(
        makeSong({
          workingBpm: null,
          practiceMode: "timed",
          metronomeEnabled: false,
        }),
      ),
    ).toBe("No BPM");
  });

  it("shows BPM needed when a metronome ladder song has no working BPM", () => {
    expect(bpmLabel(makeSong({ workingBpm: null }))).toBe("BPM needed");
  });
});

describe("moveSongIds", () => {
  it("moves a song id from one index to another", () => {
    expect(moveSongIds(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns the original order when moving past list bounds", () => {
    expect(moveSongIds(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveSongIds(["a", "b", "c"], 2, 3)).toEqual(["a", "b", "c"]);
  });
});
