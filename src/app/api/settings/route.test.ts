import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/song";
import { PATCH, PUT } from "./route";

let settings = { ...DEFAULT_SETTINGS };
let written: unknown = null;

vi.mock("@/lib/db/fileStore", () => ({
  readJson: vi.fn(async () => settings),
  updateJsonAtomic: vi.fn(async (_file, fallback, mutator) => {
    const { value, result } = await mutator(settings ?? fallback);
    written = value;
    settings = value;
    return result;
  }),
  writeJsonAtomic: vi.fn(async (_file, value) => {
    written = value;
    settings = value;
  }),
}));

describe("settings API validation", () => {
  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    written = null;
  });

  it("applies validated settings patches", async () => {
    const res = await PATCH(
      new Request("http://test/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ metronomeVolume: 0.5 }),
      }),
    );

    expect(res.status).toBe(200);
    expect(written).toEqual({ ...DEFAULT_SETTINGS, metronomeVolume: 0.5 });
  });

  it("rejects invalid settings patches", async () => {
    const res = await PATCH(
      new Request("http://test/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ metronomeVolume: 2 }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "settings.metronomeVolume must be between 0 and 1",
    });
  });

  it("validates legacy full settings replacement", async () => {
    const res = await PUT(
      new Request("http://test/api/settings", {
        method: "PUT",
        body: JSON.stringify({ ...DEFAULT_SETTINGS, metronomeVolume: 2 }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "settings.metronomeVolume must be between 0 and 1",
    });
  });
});
