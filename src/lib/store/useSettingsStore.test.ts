import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "@/lib/db/repository";
import { DEFAULT_SETTINGS } from "@/types/song";
import { useSettingsStore } from "./useSettingsStore";

const repo: Partial<Repository> = {};

vi.mock("@/lib/db/localRepository", () => ({
  getRepository: () => repo,
}));

describe("useSettingsStore persistence recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(repo) as Array<keyof Repository>) {
      delete repo[key];
    }
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, metronomeVolume: 0.8 },
      loaded: true,
    });
  });

  it("reverts optimistic settings updates when persistence fails", async () => {
    repo.saveSettings = vi.fn(async () => {
      throw new Error("PATCH /api/settings failed: 400");
    });

    await expect(
      useSettingsStore.getState().update({ metronomeVolume: 0.5 }),
    ).rejects.toThrow("400");

    expect(useSettingsStore.getState().settings.metronomeVolume).toBe(0.8);
  });
});
