import { create } from "zustand";
import type { SessionRecord } from "@/types/sessionRecord";
import { getRepository } from "@/lib/db/localRepository";

type SessionHistoryState = {
  records: SessionRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  append: (rec: SessionRecord) => Promise<void>;
  /** Patch a session record (currently only durationSec). Returns the
   * updated record so callers can compute deltas. Server validates that
   * durationSec is trimmed-only (never extended). */
  update: (id: string, patch: { durationSec: number }) => Promise<SessionRecord>;
  /** Delete a session record by id. Returns the removed record so callers
   * can roll back per-item totalPracticeSec. */
  remove: (id: string) => Promise<SessionRecord>;
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

  update: async (id, patch) => {
    const updated = await getRepository().updateSession(id, patch);
    set({
      records: get().records.map((r) => (r.id === id ? updated : r)),
    });
    return updated;
  },

  remove: async (id) => {
    const removed = await getRepository().deleteSession(id);
    set({ records: get().records.filter((r) => r.id !== id) });
    return removed;
  },
}));

export const genSessionRecordId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
