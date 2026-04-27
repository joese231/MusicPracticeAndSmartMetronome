import { v4 as uuidv4 } from "uuid";
import { SessionRecord, PromotionEvent } from "@/types/sessionRecord";

// Threshold for interpreting bare numbers as minutes (e.g., "25" = 25 minutes).
// Numbers >= 360 are interpreted as seconds instead. 360 = 6 hours.
const BARE_NUMBER_MINUTE_THRESHOLD = 360;

// ID for free-form manual sessions (those without an exercise or song)
const FREE_FORM_SESSION_ID = "__manual__";

export function parseDurationToSeconds(input: string): number {
  if (!input || !input.trim()) {
    throw new Error("Duration cannot be empty");
  }

  const trimmed = input.trim();

  // Try parsing as "25m 30s" format
  const mAndSRegex = /^(\d+)m\s*(\d+)s$/;
  const mAndSMatch = trimmed.match(mAndSRegex);
  if (mAndSMatch) {
    const minutes = parseInt(mAndSMatch[1], 10);
    const seconds = parseInt(mAndSMatch[2], 10);
    return minutes * 60 + seconds;
  }

  // Try parsing as "25m" format
  const mOnlyRegex = /^(\d+)m?$/;
  const mOnlyMatch = trimmed.match(mOnlyRegex);
  if (mOnlyMatch) {
    // If it has 'm', treat as minutes. Otherwise, if it's a number < BARE_NUMBER_MINUTE_THRESHOLD, treat as minutes; else seconds.
    if (trimmed.includes("m")) {
      return parseInt(mOnlyMatch[1], 10) * 60;
    }
    // Ambiguous: a bare number. Assume minutes if < threshold, else seconds.
    const num = parseInt(mOnlyMatch[1], 10);
    return num < BARE_NUMBER_MINUTE_THRESHOLD ? num * 60 : num;
  }

  // Try parsing as "90s" format
  const sOnlyRegex = /^(\d+)s$/;
  const sOnlyMatch = trimmed.match(sOnlyRegex);
  if (sOnlyMatch) {
    return parseInt(sOnlyMatch[1], 10);
  }

  throw new Error(
    `Invalid duration format: "${input}". Use formats like "25" (${BARE_NUMBER_MINUTE_THRESHOLD}+ = seconds), "25m", "25m 30s", or "90s"`
  );
}

/**
 * Parameters for manually creating a SessionRecord.
 *
 * Exactly one of exerciseId, songId, or sessionTitle should be provided:
 * - exerciseId: creates a record for an exercise
 * - songId: creates a record for a song
 * - sessionTitle: creates a free-form record (e.g., jam session)
 *
 * Precedence: exerciseId > songId > sessionTitle (if multiple are provided, exerciseId wins)
 *
 * @example
 * // Exercise session
 * createManualSessionRecord({
 *   exerciseId: "ex1",
 *   exerciseTitle: "Banjo Warm-up",
 *   startedAt: "2026-04-27T14:30:00",
 *   durationSec: 1500,
 * });
 *
 * // Free-form session
 * createManualSessionRecord({
 *   sessionTitle: "Jam session",
 *   startedAt: "2026-04-27T14:30:00",
 *   durationSec: 3600,
 * });
 */
interface CreateManualSessionParams {
  exerciseId?: string;
  exerciseTitle?: string;
  songId?: string;
  songTitle?: string;
  sessionTitle?: string; // For free-form sessions
  startedAt: string; // ISO 8601
  durationSec: number;
  startWorkingBpm?: number;
  endWorkingBpm?: number;
  startTroubleBpms?: (number | null)[]; // Must match song.troubleSpots.length
  endTroubleBpms?: (number | null)[]; // Must match song.troubleSpots.length
  promotions?: PromotionEvent[];
}

export function createManualSessionRecord(
  params: CreateManualSessionParams
): SessionRecord {
  const {
    exerciseId,
    exerciseTitle,
    songId,
    songTitle,
    sessionTitle,
    startedAt,
    durationSec,
    startWorkingBpm,
    endWorkingBpm,
    startTroubleBpms = [],
    endTroubleBpms = [],
    promotions = [],
  } = params;

  // Determine itemId and itemTitle
  let itemId: string;
  let itemKind: "song" | "exercise";
  let itemTitle: string;

  if (exerciseId) {
    itemId = exerciseId;
    itemKind = "exercise";
    itemTitle = exerciseTitle || "Unnamed Exercise";
  } else if (songId) {
    itemId = songId;
    itemKind = "song";
    itemTitle = songTitle || "Unnamed Song";
  } else {
    // Free-form session
    itemId = FREE_FORM_SESSION_ID;
    itemKind = "song"; // Default to song for free-form
    itemTitle = sessionTitle || "Manual Session";
  }

  // Calculate endedAt from startedAt + durationSec while preserving input format.
  // Preserve the input format (with or without 'Z' suffix) to maintain data consistency.
  const hadZSuffix = startedAt.endsWith("Z");
  const baseString = hadZSuffix
    ? startedAt
    : startedAt + "Z"; // Add Z for parsing if not present

  const startDate = new Date(baseString);
  const endDate = new Date(startDate.getTime() + durationSec * 1000);

  // Format endedAt to match the input format
  let endedAt = endDate.toISOString();
  if (!hadZSuffix) {
    // Input didn't have 'Z', so remove it and milliseconds from output
    endedAt = endedAt.replace(/\.000Z$/, "");
  }

  const record: SessionRecord = {
    id: uuidv4(),
    itemId,
    itemKind,
    itemTitle,
    startedAt,
    endedAt,
    durationSec,
    endedReason: "manual",
    plannedMinutes: Math.round(durationSec / 60), // Round to nearest minute
    startWorkingBpm,
    endWorkingBpm,
    startTroubleBpms,
    endTroubleBpms,
    promotions,
  };

  return record;
}
