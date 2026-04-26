import { create } from "zustand";
import type { Settings } from "@/types/song";
import { DEFAULT_SETTINGS } from "@/types/song";
import { getRepository } from "@/lib/db/localRepository";

type SettingsState = {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  load: async () => {
    const settings = await getRepository().getSettings();
    set({ settings, loaded: true });
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await getRepository().saveSettings(next);
  },
}));
