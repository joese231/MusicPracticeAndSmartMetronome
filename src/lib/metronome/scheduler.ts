import {
  scheduleClick,
  playTransitionCue,
  prewarmClickBuffers,
  type ClickVoice,
} from "./click";

export type MetronomeMode = "all" | "backbeat";

type BeatListener = (beatIndex: number, audioTime: number) => void;

export type MetronomeDiagnostics = {
  instanceId: number;
  bpm: number;
  mode: MetronomeMode;
  accentsEnabled: boolean;
  beatIndex: number;
  lastVoice: ClickVoice | "silent" | null;
  masterGainValue: number;
  alignCount: number;
  lateTickCount: number;
  running: boolean;
  ctxState: AudioContextState | "none";
};

const LOOKAHEAD_MS = 25;
const SCHEDULE_HORIZON_SEC = 0.1;
const MAX_LATE_SEC = 0.02;
const REANCHOR_LEAD_SEC = 0.05;

/**
 * Scheduler recovery. The 25ms setInterval is soft — under React renders,
 * RAF work, GC, or a backgrounded tab it can fire tens to hundreds of ms
 * late. When `nextBeatTime` is well behind `now`, the scheduling loop would
 * queue every missed beat with its original past timestamp and Web Audio
 * would start them all "as soon as possible", summing through masterGain
 * into a single loud, "accented" transient.
 *
 * Recovery snaps forward by integer multiples of the beat period so the
 * resumed rhythm lands on the same grid as before the stall. Without this
 * phase-preservation, a single stall produced one beat ~(REANCHOR_LEAD_SEC
 * + stall_ms) off the grid — inaudible with frequency-accented clicks but
 * heard as a "random accent" when every click is the same voice.
 *
 * `skippedBeats` is the number of grid positions jumped past, so the caller
 * can advance its beatIndex to keep the accent pattern in phase with the
 * bar.
 */
export function recoverFromDrift(
  nextBeatTime: number,
  now: number,
  secondsPerBeat: number,
): { nextBeatTime: number; skipped: boolean; skippedBeats: number } {
  if (nextBeatTime < now - MAX_LATE_SEC) {
    const target = now + REANCHOR_LEAD_SEC;
    const steps = Math.ceil((target - nextBeatTime) / secondsPerBeat);
    return {
      nextBeatTime: nextBeatTime + steps * secondsPerBeat,
      skipped: true,
      skippedBeats: steps,
    };
  }
  return { nextBeatTime, skipped: false, skippedBeats: 0 };
}

let nextInstanceId = 1;

// ------- Debug instrumentation -------
//
// When enabled, every click scheduled by any Metronome instance is recorded
// with its instance id, beat index, audio-time, wall-clock time, and voice.
// On each new beat we check the recent window for any other scheduled beat
// within COLLISION_WINDOW_SEC — a collision is the exact shape of "two clicks
// summing into one louder click" that makes an accents-off session sound
// randomly accented. Collisions are counted and console.warn'd so they show
// up even if the debug overlay isn't visible.

const COLLISION_WINDOW_SEC = 0.04; // envelope length in click.ts
const LOG_KEEP_COUNT = 200;
const JITTER_THRESHOLD_MS = 3; // |actual gap − expected gap| above this = suspicious

type ScheduledBeatLog = {
  instanceId: number;
  beatIndex: number;
  audioTime: number;
  wallTimeMs: number;
  voice: ClickVoice;
  bpm: number;
  scheduledInPast: boolean;
  jitterMs: number; // (actual gap − expected gap) vs the prior beat from same instance
};

type BeatCollision = {
  a: ScheduledBeatLog;
  b: ScheduledBeatLog;
  gapMs: number;
};

let metronomeDebugEnabled = false;
const recentBeats: ScheduledBeatLog[] = [];
let collisionCount = 0;
let lastCollision: BeatCollision | null = null;
let jitterCount = 0; // beats whose |jitter| exceeded threshold
let pastScheduleCount = 0; // beats scheduled at a time already in the past
let maxJitterMs = 0;

export function enableMetronomeDebug(on: boolean = true): void {
  metronomeDebugEnabled = on;
  if (!on) {
    recentBeats.length = 0;
    collisionCount = 0;
    lastCollision = null;
    jitterCount = 0;
    pastScheduleCount = 0;
    maxJitterMs = 0;
  }
}

export function isMetronomeDebugEnabled(): boolean {
  return metronomeDebugEnabled;
}

export type MetronomeDebugStats = {
  collisionCount: number;
  lastCollision: BeatCollision | null;
  recentBeats: ReadonlyArray<ScheduledBeatLog>;
  jitterCount: number;
  pastScheduleCount: number;
  maxJitterMs: number;
};

export function getMetronomeDebugStats(): MetronomeDebugStats {
  return {
    collisionCount,
    lastCollision,
    recentBeats: recentBeats.slice(-40),
    jitterCount,
    pastScheduleCount,
    maxJitterMs,
  };
}

function findPriorBeatForInstance(
  instanceId: number,
): ScheduledBeatLog | null {
  for (let i = recentBeats.length - 1; i >= 0; i--) {
    if (recentBeats[i].instanceId === instanceId) return recentBeats[i];
  }
  return null;
}

function logScheduledBeat(entry: ScheduledBeatLog): void {
  if (!metronomeDebugEnabled) return;

  // Phase-aware jitter: the gap should be a whole multiple of the beat
  // period. Report only the off-grid residue (gap mod P, signed). A clean
  // skip of N beats reads as 0; only true phase misalignment registers.
  // Skipped across a BPM change (the grid itself moved).
  const prior = findPriorBeatForInstance(entry.instanceId);
  if (prior && prior.bpm === entry.bpm) {
    const actualGap = entry.audioTime - prior.audioTime;
    const expectedGap = 60 / entry.bpm;
    const nearestBeats = Math.max(1, Math.round(actualGap / expectedGap));
    const phaseErrorMs = (actualGap - nearestBeats * expectedGap) * 1000;
    entry.jitterMs = phaseErrorMs;
    const absJitter = Math.abs(phaseErrorMs);
    if (absJitter > maxJitterMs) maxJitterMs = absJitter;
    if (absJitter > JITTER_THRESHOLD_MS) {
      jitterCount += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[metronome-debug] phase error #${jitterCount}: instance=${entry.instanceId}, ` +
          `beats=${prior.beatIndex}→${entry.beatIndex} ` +
          `(skipped ${nearestBeats - 1}), ` +
          `expectedGap=${(expectedGap * 1000).toFixed(2)}ms × ${nearestBeats}, ` +
          `actualGap=${(actualGap * 1000).toFixed(2)}ms, ` +
          `phaseΔ=${phaseErrorMs >= 0 ? "+" : ""}${phaseErrorMs.toFixed(2)}ms, ` +
          `scheduledInPast=${entry.scheduledInPast}`,
      );
    }
  }

  if (entry.scheduledInPast) {
    pastScheduleCount += 1;
  }

  // Check for collisions against recent beats *before* appending.
  for (let i = recentBeats.length - 1; i >= 0; i--) {
    const other = recentBeats[i];
    const gap = Math.abs(entry.audioTime - other.audioTime);
    if (gap > COLLISION_WINDOW_SEC + 1) break;
    if (gap <= COLLISION_WINDOW_SEC) {
      collisionCount += 1;
      const collision: BeatCollision = {
        a: other,
        b: entry,
        gapMs: gap * 1000,
      };
      lastCollision = collision;
      const sameInstance = other.instanceId === entry.instanceId;
      // eslint-disable-next-line no-console
      console.warn(
        `[metronome-debug] collision #${collisionCount}: ` +
          `${sameInstance ? "SAME instance" : "DIFFERENT instances"} ` +
          `(${other.instanceId} vs ${entry.instanceId}), ` +
          `gap=${collision.gapMs.toFixed(2)}ms, ` +
          `voices=${other.voice}/${entry.voice}, ` +
          `beats=${other.beatIndex}/${entry.beatIndex}, ` +
          `audioTimes=${other.audioTime.toFixed(4)}/${entry.audioTime.toFixed(4)}`,
      );
    }
  }
  recentBeats.push(entry);
  if (recentBeats.length > LOG_KEEP_COUNT) recentBeats.shift();
}

if (typeof window !== "undefined") {
  // Make it trivially toggleable from the browser console too.
  (window as unknown as {
    __metronomeDebug?: {
      enable: (on?: boolean) => void;
      stats: () => MetronomeDebugStats;
    };
  }).__metronomeDebug = {
    enable: enableMetronomeDebug,
    stats: getMetronomeDebugStats,
  };
}

// Shared across every Metronome in the page. Closing and recreating an
// AudioContext between sessions leaves the replacement in "suspended" state
// without a direct user gesture to resume it, so the second session's
// metronome would run its scheduler against a silent context. One context,
// unlocked once from the Start button click, avoids that entirely.
let sharedCtx: AudioContext | null = null;

function getSharedCtx(): AudioContext | null {
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const Ctor =
    typeof window !== "undefined"
      ? (window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
      : undefined;
  if (!Ctor) return null;
  sharedCtx = new Ctor();
  return sharedCtx;
}

export function unlockSharedAudioContext(): void {
  const ctx = getSharedCtx();
  if (ctx && ctx.state !== "running") {
    void ctx.resume();
  }
}

// Eagerly create + unlock the shared context on the very first user
// interaction anywhere in the app. This guarantees that by the time ANY
// Metronome instance is created (including the 2nd, 3rd... session), the
// shared AudioContext has already been created inside a real user gesture
// and is in the "running" state. Without this, a Metronome created from a
// useEffect on the session page would hit a suspended ctx whose resume()
// cannot unlock because the effect callback is not a gesture handler.
if (typeof window !== "undefined") {
  const unlockOnce = () => {
    unlockSharedAudioContext();
    window.removeEventListener("pointerdown", unlockOnce, true);
    window.removeEventListener("keydown", unlockOnce, true);
    window.removeEventListener("touchstart", unlockOnce, true);
  };
  window.addEventListener("pointerdown", unlockOnce, true);
  window.addEventListener("keydown", unlockOnce, true);
  window.addEventListener("touchstart", unlockOnce, true);
}

export class Metronome {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private bpm = 120;
  private mode: MetronomeMode = "all";
  private accentsEnabled = true;
  private volume = 0.8;

  private running = false;
  private nextBeatTime = 0;
  private beatIndex = 0; // 0..3 within a bar, increments each beat (including silent ones)
  private timerId: ReturnType<typeof setInterval> | null = null;
  private beatListeners = new Set<BeatListener>();

  // Diagnostic-only fields. Zero audio-path cost — updated at existing
  // scheduling points and surfaced via getDiagnostics(). Safe to keep on in
  // production; the overlay that reads them is gated behind ?debug=1.
  private readonly instanceId = nextInstanceId++;
  private lastVoice: ClickVoice | "silent" | null = null;
  private alignCount = 0;
  private lateTickCount = 0;

  async start(bpm: number, mode: MetronomeMode = "all"): Promise<void> {
    this.bpm = bpm;
    this.mode = mode;

    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        // Will degrade to silent — shouldn't happen since the shared ctx
        // is unlocked on first user interaction.
      }
    }
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    this.running = true;
    this.beatIndex = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.startTicker();
  }

  pause(): void {
    this.running = false;
    this.stopTicker();
  }

  resume(): void {
    if (!this.ctx) return;
    this.running = true;
    this.nextBeatTime = Math.max(
      this.nextBeatTime,
      this.ctx.currentTime + 0.05,
    );
    this.startTicker();
  }

  stop(): void {
    this.running = false;
    this.stopTicker();
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.ctx && this.running) {
      this.nextBeatTime = Math.max(
        this.nextBeatTime,
        this.ctx.currentTime + 0.05,
      );
    }
  }

  /**
   * Align the next-to-be-scheduled beat to a downbeat (beat 0 of the bar).
   * Called at block boundaries so each new block starts with a fresh accent
   * pattern.
   *
   * The look-ahead scheduler has already queued up to SCHEDULE_HORIZON_SEC
   * of future beats in the Web Audio graph, each with a baked-in voice +
   * start time. Simply resetting beatIndex would let those pre-scheduled
   * beats fire with their old voice (and, at a tempo change, their old
   * spacing) — the user hears a non-downbeat as the "first" beat of the
   * new block and the accent pattern looks ragged at boundaries.
   *
   * Swapping the master gain node cuts those queued oscillators loose:
   * they keep running in the audio graph but feed into a gain node that's
   * no longer connected to destination, so they're silent. Fresh beats
   * route through the new gain. The oscillators clean themselves up via
   * their existing osc.stop(time+0.05) schedule.
   */
  alignToDownbeat(): void {
    this.beatIndex = 0;
    this.alignCount += 1;
    if (!this.ctx) return;
    const old = this.masterGain;
    if (old) {
      try {
        old.disconnect();
      } catch {
        // already disconnected
      }
    }
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    // Start the new pattern a hair in the future so the first downbeat
    // doesn't race the silent tail of the old pattern.
    this.nextBeatTime = this.ctx.currentTime + 0.05;
  }

  setMode(mode: MetronomeMode): void {
    this.mode = mode;
  }

  setAccentsEnabled(on: boolean): void {
    this.accentsEnabled = on;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  playTransitionCue(): void {
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    playTransitionCue(this.ctx, this.masterGain);
  }

  /**
   * Plays a single one-off click right now using current voice settings.
   * Used by the settings page for volume/accents preview.
   */
  playPreviewClick(): void {
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    const voice: ClickVoice = this.accentsEnabled ? "downbeat" : "uniform";
    scheduleClick(this.ctx, this.masterGain, voice, this.ctx.currentTime + 0.02);
  }

  onBeat(cb: BeatListener): () => void {
    this.beatListeners.add(cb);
    return () => {
      this.beatListeners.delete(cb);
    };
  }

  getDiagnostics(): MetronomeDiagnostics {
    return {
      instanceId: this.instanceId,
      bpm: this.bpm,
      mode: this.mode,
      accentsEnabled: this.accentsEnabled,
      beatIndex: this.beatIndex,
      lastVoice: this.lastVoice,
      masterGainValue: this.masterGain?.gain.value ?? 0,
      alignCount: this.alignCount,
      lateTickCount: this.lateTickCount,
      running: this.running,
      ctxState: this.ctx?.state ?? "none",
    };
  }

  dispose(): void {
    this.stop();
    this.beatListeners.clear();
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // already disconnected
      }
      this.masterGain = null;
    }
    this.ctx = null;
  }

  private ensureContext(): void {
    if (this.ctx && this.masterGain) return;
    const ctx = getSharedCtx();
    if (!ctx) return;
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(ctx.destination);
    prewarmClickBuffers(ctx);
  }

  private startTicker(): void {
    if (this.timerId != null) return;
    this.timerId = setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  private stopTicker(): void {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private tick(): void {
    if (!this.running || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const secondsPerBeat = 60 / this.bpm;
    const recovery = recoverFromDrift(this.nextBeatTime, now, secondsPerBeat);
    if (recovery.skipped) {
      this.nextBeatTime = recovery.nextBeatTime;
      this.beatIndex += recovery.skippedBeats;
      this.lateTickCount += 1;
    }

    const horizon = now + SCHEDULE_HORIZON_SEC;

    while (this.nextBeatTime < horizon) {
      this.scheduleBeat(this.beatIndex, this.nextBeatTime);
      this.advance();
    }
  }

  private scheduleBeat(beatIndex: number, time: number): void {
    if (!this.ctx || !this.masterGain) return;
    const voice = this.voiceFor(beatIndex);
    this.lastVoice = voice ?? "silent";
    if (voice != null) {
      scheduleClick(this.ctx, this.masterGain, voice, time);
      if (metronomeDebugEnabled) {
        const now = this.ctx.currentTime;
        logScheduledBeat({
          instanceId: this.instanceId,
          beatIndex,
          audioTime: time,
          wallTimeMs: Date.now(),
          voice,
          bpm: this.bpm,
          scheduledInPast: time < now,
          jitterMs: 0,
        });
      }
    }
    // Notify beat listeners regardless of whether the beat was audible
    // — the visual pulse should animate on every beat slot.
    for (const cb of this.beatListeners) {
      cb(beatIndex, time);
    }
  }

  private voiceFor(beatIndex: number): ClickVoice | null {
    const pos = beatIndex % 4;
    if (this.mode === "backbeat") {
      if (pos === 1 || pos === 3) {
        return this.accentsEnabled ? "accent" : "uniform";
      }
      return null;
    }
    // all-beats mode
    if (!this.accentsEnabled) return "uniform";
    return pos === 0 ? "downbeat" : "tick";
  }

  private advance(): void {
    const secondsPerBeat = 60 / this.bpm;
    this.nextBeatTime += secondsPerBeat;
    this.beatIndex += 1;
  }
}
