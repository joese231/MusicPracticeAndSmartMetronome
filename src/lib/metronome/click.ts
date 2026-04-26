export type ClickVoice = "accent" | "downbeat" | "tick" | "uniform";

type VoiceConfig = {
  freq: number;
  gain: number;
};

const VOICES: Record<ClickVoice, VoiceConfig> = {
  accent: { freq: 1500, gain: 0.9 },
  downbeat: { freq: 1200, gain: 0.75 },
  tick: { freq: 900, gain: 0.5 },
  uniform: { freq: 1100, gain: 0.7 },
};

// Click envelope shape (seconds, matching the legacy oscillator+env graph):
//   0 .. ATTACK_SEC          : linear 0 → gain
//   ATTACK_SEC .. DECAY_END  : exponential gain → SUSTAIN_FLOOR
//   DECAY_END .. CLICK_LEN   : held at SUSTAIN_FLOOR
const ATTACK_SEC = 0.002;
const DECAY_END = 0.04;
const CLICK_LEN = 0.05;
const SUSTAIN_FLOOR = 0.0001;

const TRANSITION_ATTACK = 0.01;
const TRANSITION_DECAY_END = 0.14;
const TRANSITION_LEN = 0.16;
const TRANSITION_PEAK = 0.5;
const TRANSITION_FREQS = [880, 1320] as const;
const TRANSITION_GAP_SEC = 0.12;

// Per-click output must be byte-identical: the investigation into the
// "random accents with accents-off" bug ruled out scheduler jitter (all four
// timing counters came back at zero), leaving per-call Web Audio
// parameter-automation variability as the remaining suspect. Rendering each
// voice once into a buffer and replaying via AudioBufferSourceNode removes
// that variability entirely — every click is literally the same sample stream.
type CtxBufferCache = Map<string, AudioBuffer>;
const bufferCacheByCtx = new WeakMap<AudioContext, CtxBufferCache>();

function getCtxCache(ctx: AudioContext): CtxBufferCache {
  let cache = bufferCacheByCtx.get(ctx);
  if (!cache) {
    cache = new Map();
    bufferCacheByCtx.set(ctx, cache);
  }
  return cache;
}

function renderEnvelope(
  t: number,
  peak: number,
  attackEnd: number,
  decayEnd: number,
): number {
  if (t < attackEnd) {
    return (t / attackEnd) * peak;
  }
  if (t < decayEnd) {
    const ratio = SUSTAIN_FLOOR / peak;
    return peak * Math.pow(ratio, (t - attackEnd) / (decayEnd - attackEnd));
  }
  return SUSTAIN_FLOOR;
}

function renderClickBuffer(ctx: AudioContext, voice: ClickVoice): AudioBuffer {
  const { freq, gain } = VOICES[voice];
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(CLICK_LEN * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const twoPiF = 2 * Math.PI * freq;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = renderEnvelope(t, gain, ATTACK_SEC, DECAY_END);
    data[i] = Math.sin(twoPiF * t) * env;
  }
  return buffer;
}

function renderTransitionNoteBuffer(
  ctx: AudioContext,
  freq: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(TRANSITION_LEN * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const twoPiF = 2 * Math.PI * freq;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = renderEnvelope(
      t,
      TRANSITION_PEAK,
      TRANSITION_ATTACK,
      TRANSITION_DECAY_END,
    );
    data[i] = Math.sin(twoPiF * t) * env;
  }
  return buffer;
}

function getClickBuffer(ctx: AudioContext, voice: ClickVoice): AudioBuffer {
  const cache = getCtxCache(ctx);
  const key = `click:${voice}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = renderClickBuffer(ctx, voice);
    cache.set(key, buf);
  }
  return buf;
}

function getTransitionBuffer(ctx: AudioContext, freq: number): AudioBuffer {
  const cache = getCtxCache(ctx);
  const key = `transition:${freq}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = renderTransitionNoteBuffer(ctx, freq);
    cache.set(key, buf);
  }
  return buf;
}

export function scheduleClick(
  ctx: AudioContext,
  masterGain: GainNode,
  voice: ClickVoice,
  time: number,
): void {
  const source = ctx.createBufferSource();
  source.buffer = getClickBuffer(ctx, voice);
  source.connect(masterGain);
  source.start(time);
}

export function playTransitionCue(
  ctx: AudioContext,
  masterGain: GainNode,
): void {
  const now = ctx.currentTime;
  for (let i = 0; i < TRANSITION_FREQS.length; i++) {
    const source = ctx.createBufferSource();
    source.buffer = getTransitionBuffer(ctx, TRANSITION_FREQS[i]);
    source.connect(masterGain);
    source.start(now + i * TRANSITION_GAP_SEC);
  }
}

// Pre-renders every click voice into the context's buffer cache. Safe to call
// from async code paths (session start); a no-op after the first call per ctx.
export function prewarmClickBuffers(ctx: AudioContext): void {
  (Object.keys(VOICES) as ClickVoice[]).forEach((voice) => {
    getClickBuffer(ctx, voice);
  });
  for (const freq of TRANSITION_FREQS) {
    getTransitionBuffer(ctx, freq);
  }
}
