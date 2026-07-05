import type { LatestRecording } from "@/types/recording";
import type { PromotionEvent, SessionRecord } from "@/types/sessionRecord";
import { FREE_PLAY_ITEM_ID, FREE_PLAY_ITEM_TITLE } from "./freePlay";

type EndedReason = SessionRecord["endedReason"];

const roundedDuration = (elapsedSec: number): number =>
  Math.max(0, Math.round(elapsedSec));

export type IntermissionTiming = {
  startedAtMs: number;
  durationSec: number;
};

export function buildSongSessionRecord({
  id,
  itemId,
  itemTitle,
  startedAt,
  endedAt,
  elapsedSec,
  endedReason,
  plannedMinutes,
  startWorkingBpm,
  endWorkingBpm,
  startTroubleBpms,
  endTroubleBpms,
  promotions,
}: {
  id: string;
  itemId: string;
  itemTitle: string;
  startedAt: string;
  endedAt: string;
  elapsedSec: number;
  endedReason: EndedReason;
  plannedMinutes: number;
  startWorkingBpm?: number;
  endWorkingBpm?: number;
  startTroubleBpms: (number | null)[];
  endTroubleBpms: (number | null)[];
  promotions: PromotionEvent[];
}): SessionRecord {
  return {
    id,
    itemId,
    itemKind: "song",
    itemTitle,
    startedAt,
    endedAt,
    durationSec: roundedDuration(elapsedSec),
    endedReason,
    plannedMinutes,
    startWorkingBpm,
    endWorkingBpm,
    startTroubleBpms,
    endTroubleBpms,
    promotions,
  };
}

export function buildExerciseSessionRecord({
  id,
  itemId,
  itemTitle,
  startedAt,
  endedAt,
  elapsedSec,
  endedReason,
  plannedMinutes,
  startWorkingBpm,
  endWorkingBpm,
  promotions,
}: {
  id: string;
  itemId: string;
  itemTitle: string;
  startedAt: string;
  endedAt: string;
  elapsedSec: number;
  endedReason: EndedReason;
  plannedMinutes: number;
  startWorkingBpm: number;
  endWorkingBpm: number;
  promotions: PromotionEvent[];
}): SessionRecord {
  return {
    id,
    itemId,
    itemKind: "exercise",
    itemTitle,
    startedAt,
    endedAt,
    durationSec: roundedDuration(elapsedSec),
    endedReason,
    plannedMinutes,
    startWorkingBpm,
    endWorkingBpm,
    startTroubleBpms: [],
    endTroubleBpms: [],
    promotions,
  };
}

export function buildFreePlaySessionRecord({
  id,
  startedAt,
  endedAt,
  elapsedSec,
  bpm,
}: {
  id: string;
  startedAt: string;
  endedAt: string;
  elapsedSec: number;
  bpm: number;
}): SessionRecord {
  return {
    id,
    itemId: FREE_PLAY_ITEM_ID,
    itemKind: "freePlay",
    itemTitle: FREE_PLAY_ITEM_TITLE,
    startedAt,
    endedAt,
    durationSec: roundedDuration(elapsedSec),
    endedReason: "complete",
    plannedMinutes: 0,
    startWorkingBpm: bpm,
    endWorkingBpm: bpm,
    startTroubleBpms: [],
    endTroubleBpms: [],
    promotions: [],
  };
}

export function buildLatestRecording(recording: LatestRecording): LatestRecording {
  return recording;
}

export function intermissionRemainingSec(
  intermission: IntermissionTiming,
  nowMs: number,
): number {
  const elapsedMs = nowMs - intermission.startedAtMs;
  return Math.max(0, Math.ceil(intermission.durationSec - elapsedMs / 1000));
}

export function resumeIntermission<T extends IntermissionTiming>(
  intermission: T,
  pausedAtMs: number,
  nowMs: number,
): T {
  return {
    ...intermission,
    startedAtMs: intermission.startedAtMs + (nowMs - pausedAtMs),
  };
}
