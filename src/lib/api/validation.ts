import { isPlayableBpm } from "@/lib/metronome/scheduler";
import { MAX_SESSION_MINUTES, MIN_SESSION_MINUTES } from "@/lib/session/blocks";
import {
  MAX_EXERCISE_MINUTES,
  MIN_EXERCISE_MINUTES,
} from "@/lib/session/exerciseBlocks";
import type { Exercise } from "@/types/exercise";
import type {
  BlockDurationRule,
  ExerciseBlockTemplate,
  PracticeMode,
  ProgressionRule,
  Settings,
  SmartBlockRecipe,
  SmartBlockRole,
  Song,
  SongBlockTemplate,
  TempoAdjustment,
  TempoRule,
  TroubleSpot,
} from "@/types/song";

export type ApiValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type SongPatchRequest = {
  expectedUpdatedAt?: string;
  patch: Partial<Song>;
};

export type ExercisePatchRequest = {
  expectedUpdatedAt?: string;
  patch: Partial<Exercise>;
};

const PRACTICE_MODES = new Set<PracticeMode>([
  "smart",
  "simple",
  "timed",
  "openEnded",
]);

const SMART_ROLES = new Set<SmartBlockRole>([
  "slowReference",
  "troubleSpot",
  "ceilingWork",
  "overspeed",
  "consolidation",
  "exerciseBuild",
  "exerciseBurst",
  "exerciseCoolDown",
  "custom",
]);

const SONG_PATCH_FIELDS = new Set<keyof Song>([
  "title",
  "link",
  "workingBpm",
  "warmupBpm",
  "troubleSpots",
  "originalBpm",
  "stepPercent",
  "practiceMode",
  "includeWarmupBlock",
  "blockTemplate",
  "defaultSessionMinutes",
  "metronomeEnabled",
  "sortIndex",
  "updatedAt",
]);

const EXERCISE_PATCH_FIELDS = new Set<keyof Exercise>([
  "name",
  "link",
  "notes",
  "workingBpm",
  "warmupBpm",
  "stepPercent",
  "sessionMinutes",
  "openEnded",
  "metronomeEnabled",
  "practiceMode",
  "includeWarmupBlock",
  "blockTemplate",
  "sortIndex",
  "updatedAt",
]);

const SETTINGS_PATCH_FIELDS = new Set<keyof Settings>([
  "recordingEnabled",
  "metronomeVolume",
  "accentsEnabled",
  "autoAdvanceBlocks",
  "interSongPauseSec",
  "defaultPracticeMode",
  "defaultSongSessionMinutes",
  "defaultExerciseSessionMinutes",
  "defaultSongBlockTemplate",
  "defaultExerciseBlockTemplate",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isIsoString = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isNullablePlayableBpm = (value: unknown): value is number | null =>
  value === null || isPlayableBpm(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;

const isPracticeMode = (value: unknown): value is PracticeMode =>
  typeof value === "string" && PRACTICE_MODES.has(value as PracticeMode);

function validateTroubleSpots(value: unknown): value is TroubleSpot[] {
  return (
    Array.isArray(value) &&
    value.length <= 5 &&
    value.every(
      (spot) =>
        isObject(spot) &&
        (spot.bpm === null || isPlayableBpm(spot.bpm)),
    )
  );
}

function validateAdjustment(value: unknown): value is TempoAdjustment {
  if (!isObject(value)) return false;
  if (
    value.kind !== "percent" &&
    value.kind !== "bpmOffset" &&
    value.kind !== "steps"
  ) {
    return false;
  }
  return isFiniteNumber(value.value);
}

function validateTempoRule(value: unknown, depth = 0): value is TempoRule {
  if (!isObject(value) || depth > 5) return false;
  if (
    value.adjustment !== undefined &&
    !validateAdjustment(value.adjustment)
  ) {
    return false;
  }
  switch (value.source) {
    case "working":
    case "target":
    case "overspeed":
      return true;
    case "original":
    case "trouble":
      return validateTempoRule(value.fallback, depth + 1);
    case "fixed":
      return isPlayableBpm(value.bpm);
    default:
      return false;
  }
}

function validateDuration(value: unknown): value is BlockDurationRule {
  if (!isObject(value)) return false;
  if (value.kind === "fixed") return isNonNegativeNumber(value.seconds);
  if (value.kind === "percent") return isNonNegativeNumber(value.percent);
  return false;
}

function validateProgression(value: unknown): value is ProgressionRule {
  return (
    isObject(value) &&
    (value.kind === "none" ||
      value.kind === "working" ||
      value.kind === "trouble")
  );
}

function validateTemplate(
  value: unknown,
): value is SongBlockTemplate | ExerciseBlockTemplate {
  return (
    Array.isArray(value) &&
    value.every((entry): entry is SmartBlockRecipe => {
      if (!isObject(entry)) return false;
      if (typeof entry.id !== "string" || entry.id.length === 0) return false;
      if (typeof entry.role !== "string" || !SMART_ROLES.has(entry.role as SmartBlockRole)) {
        return false;
      }
      if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
        return false;
      }
      if (typeof entry.purpose !== "string") return false;
      if (
        !Array.isArray(entry.instructions) ||
        !entry.instructions.every((line) => typeof line === "string")
      ) {
        return false;
      }
      return (
        typeof entry.enabled === "boolean" &&
        validateDuration(entry.duration) &&
        validateTempoRule(entry.tempoRule) &&
        typeof entry.metronomeEnabled === "boolean" &&
        validateProgression(entry.progression)
      );
    })
  );
}

function validateSessionMinutes(
  field: string,
  value: unknown,
  min: number,
  max: number,
): ApiValidationResult<number> {
  if (!isFiniteNumber(value) || value < min || value > max) {
    return { ok: false, error: `${field} is out of range` };
  }
  return { ok: true, value };
}

export function validateSong(value: unknown): ApiValidationResult<Song> {
  if (!isObject(value)) return { ok: false, error: "song must be an object" };
  if (typeof value.id !== "string" || value.id.length === 0) {
    return { ok: false, error: "song.id must be a non-empty string" };
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    return { ok: false, error: "song.title must be a non-empty string" };
  }
  if (!isNullableString(value.link)) {
    return { ok: false, error: "song.link must be a string or null" };
  }
  if (!isNullablePlayableBpm(value.workingBpm)) {
    return { ok: false, error: "song.workingBpm must be null or a playable BPM" };
  }
  if (!isNullablePlayableBpm(value.warmupBpm)) {
    return { ok: false, error: "song.warmupBpm must be null or a playable BPM" };
  }
  if (!validateTroubleSpots(value.troubleSpots)) {
    return { ok: false, error: "song.troubleSpots is invalid" };
  }
  if (!isNullablePlayableBpm(value.originalBpm)) {
    return { ok: false, error: "song.originalBpm must be null or a playable BPM" };
  }
  if (!isFiniteNumber(value.stepPercent) || value.stepPercent <= 0) {
    return { ok: false, error: "song.stepPercent must be positive" };
  }
  if (!isPracticeMode(value.practiceMode)) {
    return { ok: false, error: "song.practiceMode is invalid" };
  }
  if (typeof value.includeWarmupBlock !== "boolean") {
    return { ok: false, error: "song.includeWarmupBlock must be boolean" };
  }
  if (value.blockTemplate !== undefined && !validateTemplate(value.blockTemplate)) {
    return { ok: false, error: "song.blockTemplate is invalid" };
  }
  const minutes = validateSessionMinutes(
    "song.defaultSessionMinutes",
    value.defaultSessionMinutes,
    MIN_SESSION_MINUTES,
    MAX_SESSION_MINUTES,
  );
  if (!minutes.ok) return minutes;
  if (typeof value.metronomeEnabled !== "boolean") {
    return { ok: false, error: "song.metronomeEnabled must be boolean" };
  }
  if (!isNonNegativeNumber(value.totalPracticeSec)) {
    return { ok: false, error: "song.totalPracticeSec must be non-negative" };
  }
  if (!isFiniteNumber(value.sortIndex)) {
    return { ok: false, error: "song.sortIndex must be a number" };
  }
  if (!isIsoString(value.createdAt) || !isIsoString(value.updatedAt)) {
    return { ok: false, error: "song timestamps must be ISO strings" };
  }
  return { ok: true, value: value as Song };
}

export function validateExercise(value: unknown): ApiValidationResult<Exercise> {
  if (!isObject(value)) return { ok: false, error: "exercise must be an object" };
  if (typeof value.id !== "string" || value.id.length === 0) {
    return { ok: false, error: "exercise.id must be a non-empty string" };
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    return { ok: false, error: "exercise.name must be a non-empty string" };
  }
  if (!isNullableString(value.link) || !isNullableString(value.notes)) {
    return { ok: false, error: "exercise.link and exercise.notes must be string or null" };
  }
  if (!isPlayableBpm(value.workingBpm)) {
    return { ok: false, error: "exercise.workingBpm must be a playable BPM" };
  }
  if (!isNullablePlayableBpm(value.warmupBpm)) {
    return { ok: false, error: "exercise.warmupBpm must be null or a playable BPM" };
  }
  if (!isFiniteNumber(value.stepPercent) || value.stepPercent <= 0) {
    return { ok: false, error: "exercise.stepPercent must be positive" };
  }
  const minutes = validateSessionMinutes(
    "exercise.sessionMinutes",
    value.sessionMinutes,
    MIN_EXERCISE_MINUTES,
    MAX_EXERCISE_MINUTES,
  );
  if (!minutes.ok) return minutes;
  if (
    typeof value.openEnded !== "boolean" ||
    typeof value.metronomeEnabled !== "boolean" ||
    typeof value.includeWarmupBlock !== "boolean"
  ) {
    return { ok: false, error: "exercise boolean fields are invalid" };
  }
  if (!isPracticeMode(value.practiceMode)) {
    return { ok: false, error: "exercise.practiceMode is invalid" };
  }
  if (value.blockTemplate !== undefined && !validateTemplate(value.blockTemplate)) {
    return { ok: false, error: "exercise.blockTemplate is invalid" };
  }
  if (!isNonNegativeNumber(value.totalPracticeSec)) {
    return { ok: false, error: "exercise.totalPracticeSec must be non-negative" };
  }
  if (!isFiniteNumber(value.sortIndex)) {
    return { ok: false, error: "exercise.sortIndex must be a number" };
  }
  if (!isIsoString(value.createdAt) || !isIsoString(value.updatedAt)) {
    return { ok: false, error: "exercise timestamps must be ISO strings" };
  }
  return { ok: true, value: value as Exercise };
}

export function validateSongPatch(
  value: unknown,
): ApiValidationResult<SongPatchRequest> {
  if (!isObject(value) || !isObject(value.patch)) {
    return { ok: false, error: "song patch request must include patch object" };
  }
  if (
    value.expectedUpdatedAt !== undefined &&
    !isIsoString(value.expectedUpdatedAt)
  ) {
    return { ok: false, error: "expectedUpdatedAt must be an ISO string" };
  }
  for (const key of Object.keys(value.patch)) {
    if (!SONG_PATCH_FIELDS.has(key as keyof Song)) {
      return { ok: false, error: `song patch field ${key} is not editable here` };
    }
  }
  return {
    ok: true,
    value: {
      expectedUpdatedAt: value.expectedUpdatedAt as string | undefined,
      patch: value.patch as Partial<Song>,
    },
  };
}

export function validateExercisePatch(
  value: unknown,
): ApiValidationResult<ExercisePatchRequest> {
  if (!isObject(value) || !isObject(value.patch)) {
    return { ok: false, error: "exercise patch request must include patch object" };
  }
  if (
    value.expectedUpdatedAt !== undefined &&
    !isIsoString(value.expectedUpdatedAt)
  ) {
    return { ok: false, error: "expectedUpdatedAt must be an ISO string" };
  }
  for (const key of Object.keys(value.patch)) {
    if (!EXERCISE_PATCH_FIELDS.has(key as keyof Exercise)) {
      return {
        ok: false,
        error: `exercise patch field ${key} is not editable here`,
      };
    }
  }
  return {
    ok: true,
    value: {
      expectedUpdatedAt: value.expectedUpdatedAt as string | undefined,
      patch: value.patch as Partial<Exercise>,
    },
  };
}

export function validateSettings(value: unknown): ApiValidationResult<Settings> {
  if (!isObject(value)) return { ok: false, error: "settings must be an object" };
  if (typeof value.recordingEnabled !== "boolean") {
    return { ok: false, error: "settings.recordingEnabled must be boolean" };
  }
  if (!isFiniteNumber(value.metronomeVolume) || value.metronomeVolume < 0 || value.metronomeVolume > 1) {
    return { ok: false, error: "settings.metronomeVolume must be between 0 and 1" };
  }
  if (typeof value.accentsEnabled !== "boolean") {
    return { ok: false, error: "settings.accentsEnabled must be boolean" };
  }
  if (typeof value.autoAdvanceBlocks !== "boolean") {
    return { ok: false, error: "settings.autoAdvanceBlocks must be boolean" };
  }
  if (!isFiniteNumber(value.interSongPauseSec) || value.interSongPauseSec < 0) {
    return { ok: false, error: "settings.interSongPauseSec must be non-negative" };
  }
  if (!isPracticeMode(value.defaultPracticeMode)) {
    return { ok: false, error: "settings.defaultPracticeMode is invalid" };
  }
  const songMinutes = validateSessionMinutes(
    "settings.defaultSongSessionMinutes",
    value.defaultSongSessionMinutes,
    MIN_SESSION_MINUTES,
    MAX_SESSION_MINUTES,
  );
  if (!songMinutes.ok) return songMinutes;
  const exerciseMinutes = validateSessionMinutes(
    "settings.defaultExerciseSessionMinutes",
    value.defaultExerciseSessionMinutes,
    MIN_EXERCISE_MINUTES,
    MAX_EXERCISE_MINUTES,
  );
  if (!exerciseMinutes.ok) return exerciseMinutes;
  if (!validateTemplate(value.defaultSongBlockTemplate)) {
    return { ok: false, error: "settings.defaultSongBlockTemplate is invalid" };
  }
  if (!validateTemplate(value.defaultExerciseBlockTemplate)) {
    return { ok: false, error: "settings.defaultExerciseBlockTemplate is invalid" };
  }
  return { ok: true, value: value as Settings };
}

export function validateSettingsPatch(
  value: unknown,
): ApiValidationResult<Partial<Settings>> {
  if (!isObject(value)) {
    return { ok: false, error: "settings patch must be an object" };
  }
  for (const key of Object.keys(value)) {
    if (!SETTINGS_PATCH_FIELDS.has(key as keyof Settings)) {
      return {
        ok: false,
        error: `settings patch field ${key} is not editable here`,
      };
    }
  }
  if ("metronomeVolume" in value && (!isFiniteNumber(value.metronomeVolume) || value.metronomeVolume < 0 || value.metronomeVolume > 1)) {
    return { ok: false, error: "settings.metronomeVolume must be between 0 and 1" };
  }
  if ("defaultPracticeMode" in value && !isPracticeMode(value.defaultPracticeMode)) {
    return { ok: false, error: "settings.defaultPracticeMode is invalid" };
  }
  if (
    "defaultSongSessionMinutes" in value &&
    !validateSessionMinutes(
      "settings.defaultSongSessionMinutes",
      value.defaultSongSessionMinutes,
      MIN_SESSION_MINUTES,
      MAX_SESSION_MINUTES,
    ).ok
  ) {
    return { ok: false, error: "settings.defaultSongSessionMinutes is out of range" };
  }
  if (
    "defaultExerciseSessionMinutes" in value &&
    !validateSessionMinutes(
      "settings.defaultExerciseSessionMinutes",
      value.defaultExerciseSessionMinutes,
      MIN_EXERCISE_MINUTES,
      MAX_EXERCISE_MINUTES,
    ).ok
  ) {
    return { ok: false, error: "settings.defaultExerciseSessionMinutes is out of range" };
  }
  if ("defaultSongBlockTemplate" in value && !validateTemplate(value.defaultSongBlockTemplate)) {
    return { ok: false, error: "settings.defaultSongBlockTemplate is invalid" };
  }
  if ("defaultExerciseBlockTemplate" in value && !validateTemplate(value.defaultExerciseBlockTemplate)) {
    return { ok: false, error: "settings.defaultExerciseBlockTemplate is invalid" };
  }
  const booleanFields: Array<keyof Settings> = [
    "recordingEnabled",
    "accentsEnabled",
    "autoAdvanceBlocks",
  ];
  for (const field of booleanFields) {
    if (field in value && typeof value[field] !== "boolean") {
      return { ok: false, error: `settings.${field} must be boolean` };
    }
  }
  if (
    "interSongPauseSec" in value &&
    (!isFiniteNumber(value.interSongPauseSec) || value.interSongPauseSec < 0)
  ) {
    return { ok: false, error: "settings.interSongPauseSec must be non-negative" };
  }
  return { ok: true, value: value as Partial<Settings> };
}
