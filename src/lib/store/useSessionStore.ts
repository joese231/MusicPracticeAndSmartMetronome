import { create } from "zustand";
import type { LatestRecording } from "@/types/recording";

type SessionState = {
  latestRecording: LatestRecording | null;
  setLatestRecording: (rec: LatestRecording) => void;
  clearLatestRecording: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  latestRecording: null,

  setLatestRecording: (rec) => {
    const prev = get().latestRecording;
    if (prev) {
      try {
        URL.revokeObjectURL(prev.blobUrl);
      } catch {
        // ignore
      }
    }
    set({ latestRecording: rec });
  },

  clearLatestRecording: () => {
    const prev = get().latestRecording;
    if (prev) {
      try {
        URL.revokeObjectURL(prev.blobUrl);
      } catch {
        // ignore
      }
    }
    set({ latestRecording: null });
  },
}));
