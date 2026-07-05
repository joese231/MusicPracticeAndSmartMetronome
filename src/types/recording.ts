export type LatestRecording = {
  itemKind: "song" | "exercise" | "freePlay";
  itemId: string;
  sessionId: string;
  blob: Blob;
  blobUrl: string;
  durationSec: number;
  plannedMinutes: number | null;
  createdAt: string;
};
