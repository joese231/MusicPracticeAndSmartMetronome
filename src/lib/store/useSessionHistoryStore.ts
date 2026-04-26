import { create } from "zustand";
import type { SessionRecord } from "@/types/sessionRecord";
import { getRepository } from "@/lib/db/localRepository";

type SessionHistoryState = {
  records: SessionRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  append: (rec: SessionRecord) => Promise<void>;
};

export const useSessionHistoryStore = create<SessionHistoryState>((set, get) => ({
  records: [],
  loaded: false,

  load: async () => {
    const records = await getRepository().listSessions();
    set({ records, loaded: true });
  },

  append: async (rec) => {
    set({ records: [...get().records, rec] });
    await getRepository().appendSession(rec);
  },
}));

export const genSessionRecordId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
