# Metronome "Random Accents" Bug — Investigation Log

**Status: UNRESOLVED.** Read this file in full before proposing new work on this bug. Do not re-run hypotheses already disproven.

## The bug

When the user plays a session with **Use accented clicks = OFF** (global setting, `src/app/settings/page.tsx`), the metronome produces a rhythmically-inconsistent sound: some clicks audibly stand out ("accented") while others sound normal, in a **random, non-repeating** pattern.

When **Use accented clicks = ON**, the bug does not occur. Only the downbeat (beat 1) is accented as designed, and beats 2/3/4 are uniformly unaccented.

## Key files

- `src/lib/metronome/click.ts` — the four click voices (`accent` 1500Hz, `downbeat` 1200Hz, `tick` 900Hz, `uniform` 1100Hz). With accents OFF, every beat uses `uniform`.
- `src/lib/metronome/scheduler.ts` — the look-ahead scheduler. 25 ms `setInterval`, 100 ms look-ahead, drift recovery, master gain per instance.
- `src/components/session/MetronomeDiagnostics.tsx` — debug overlay gated on `?debug=1`.
- `src/app/session/[id]/page.tsx` — session page; owns the active `Metronome` instance.
- `src/lib/metronome/scheduler.test.ts` — unit tests for `recoverFromDrift`.

Relevant CLAUDE.md section: "Metronome notes" — describes the look-ahead scheduler pattern, voice design, and drift-recovery rationale.

## Hypotheses considered

### ❌ H1: Two concurrent `Metronome` instances on the shared `AudioContext`

**Theory:** Strict-mode double-mount, HMR, or leaked instance would sum two beat streams at the destination. With uniform voice (same freq), overlapping clicks would phase-sum into a louder click → perceived as "accent". With accented mode, different voices per beat wouldn't phase-sum cleanly.

**Action taken:** Added per-instance `instanceId`. Added module-level debug recorder that logs every scheduled beat from every instance and warns on collisions within a 40 ms window (the envelope length).

**Result:** User tested with `?debug=1`. **Zero collisions** reported. Hypothesis disproven.

### ❌ H2: Double-schedule of the same beat within one instance

**Theory:** A bug in the scheduler's while-loop could queue the same beat twice (e.g., some interaction between `setBpm`'s `max(nextBeatTime, now + 0.05)` and the look-ahead horizon), producing same-instance same-frequency overlapping clicks.

**Result:** Same instrumentation as H1 — would have fired `SAME instance` collision warning. None seen. Disproven.

### ⚠ H3 (PARTIALLY EXPLORED): Timing jitter from drift recovery

**Theory:** When the main thread stalls >20 ms (React render, GC, tab throttling), `recoverFromDrift` fires and re-anchors `nextBeatTime = now + 50 ms`. This lands **off the beat grid** by up to (stall_ms + 50 ms). With uniform voice, the brain perceives rhythm by onset timing alone, so a single misplaced beat is heard as an "accent".

**Actions taken:**

1. Added instrumentation: `jitterCount`, `maxJitterMs`, `pastScheduleCount` (beats scheduled with `audioTime < ctx.currentTime`). Signed console.warn for each event.
2. **Changed `recoverFromDrift` to be phase-preserving** — it now snaps `nextBeatTime` forward by integer multiples of the beat period (`60/bpm`) until ≥ `now + 50 ms`, and bumps `beatIndex` by the number of skipped beats. Rationale: a stall now causes a *silent gap* (skipped beats) while the rhythm resumes on the original grid, rather than a misplaced beat.
3. Fixed the jitter metric itself to be phase-aware (was comparing actual gap to one beat period; now reports `actualGap mod expectedGap`, signed, so a clean N-beat skip reads as 0 ms and only true off-grid beats register). Skips BPM changes (the grid legitimately moves at BPM change boundaries).

**Result after fix:** User reports **max |Δ| is still non-zero** (not reduced to 0 or near it) and the audible symptom persists. So there are still off-grid beats happening, but `recoverFromDrift` is not the only cause — OR my fix has a bug and phase isn't actually being preserved.

**Open question as of last iteration:** Exact values of `max |Δ|`, `jitter events`, `lateTicks`, `past-sched` counters when the symptom occurs. The user has not yet reported all four counters together.

### ❌ H4: Envelope tails overlapping consecutive clicks

**Theory:** Click envelope is 40 ms (`env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)`). At metronome tempos (max ~280 BPM → 214 ms between beats), envelopes don't overlap. Disproven on inspection.

### ❌ H5: Web Audio past-time automation producing variable click shape

**Theory:** If `scheduleClick(time)` is called with `time < ctx.currentTime`, the envelope `setValueAtTime(0, time)` and the `osc.start(time)` / `osc.stop(time+0.05)` events are all in the past. Per spec, past `osc.start` starts immediately; past `osc.stop` with `time+0.05` also in the past would stop immediately → truncated/silent click. This would make some clicks *quieter*, not louder. Symptom is "louder-sounding accented clicks", not "occasionally missing clicks". Disproven by symptom mismatch.

## What's instrumented and still in the codebase

Gated behind `?debug=1` on the session URL. Overlay top-right shows:

- `instance`, `running`, `ctx`, `bpm`, `mode`, `accents`, `beat`, `lastVoice`, `gain`
- `aligns` — `alignToDownbeat` call count
- `lateTicks` — drift-recovery firings
- `count` (collisions) — same- or cross-instance clicks within 40 ms
- `jitter events` — beats with phase error > 3 ms (vs prior same-instance, same-bpm beat)
- `max |Δ|` — largest phase error in ms
- `past-sched` — beats scheduled at `audioTime < ctx.currentTime`

`window.__metronomeDebug = { enable, stats }` lets you toggle from the browser console.

All of this is free when the flag is off (guarded by a module-level boolean).

## Code changes made during investigation

1. `src/lib/metronome/scheduler.ts`:
   - Added debug recorder (collision + phase-error + past-schedule tracking).
   - Changed `recoverFromDrift` signature: now takes `secondsPerBeat`, returns `{nextBeatTime, skipped, skippedBeats}`. Snaps to grid.
   - `tick()` calls recovery with `60 / this.bpm` and bumps `this.beatIndex += skippedBeats`.
2. `src/lib/metronome/scheduler.test.ts`: tests updated for new signature + grid-snapping behavior. **All 6 tests pass.**
3. `src/components/session/MetronomeDiagnostics.tsx`: added Collisions and Timing sections.
4. `src/app/session/[id]/page.tsx`: `?debug=1` calls `enableMetronomeDebug()` on mount.

No rollback needed — the recovery grid-snap is a legit correctness fix regardless of this bug.

## What is NOT yet known / ruled out

- Whether the non-zero `max |Δ|` the user still sees is a **real off-grid beat** (so the grid-snap fix has a hole somewhere) or is a **legitimate one-off** at a BPM change / `alignToDownbeat` / session start boundary that my filter should ignore. We don't yet know the `jitter events` count — if it's 1–3 total across a session, it's boundary events; if it climbs during steady play, it's a real scheduling bug.
- Whether **`alignToDownbeat`** disturbs the grid on block transitions in a way that produces an audible misplaced beat. It sets `nextBeatTime = now + 0.05` and creates a new `masterGain`; the timing is not grid-aligned relative to whatever the prior block's grid was. The on-screen guidance (per CLAUDE.md) is that block boundaries re-align to a fresh bar, so non-grid at that instant is by design — but verify it doesn't happen mid-block.
- Whether **the envelope or oscillator setup in `scheduleClick` itself** has per-call variability the investigation hasn't surfaced. All params are deterministic on inspection, but Web Audio parameter-automation semantics in edge cases (e.g., when `ctx.currentTime > time`) could produce per-click variation in output shape.
- Whether **Bluetooth or system-audio-driver latency variance** on the user's playback chain is adding jitter downstream of Web Audio's scheduled times. The Web Audio scheduler cannot fix this. One way to rule in/out: test on wired headphones vs speakers vs Bluetooth and see if the symptom changes.
- Whether the `playTransitionCue` 880+1320 Hz chime or any other audio source is somehow leaking during `playing` phase.

## Directions NOT yet tried

- Record the audio output (MediaRecorder is already in the app) during a session with accents OFF, then analyze the recorded waveform to objectively measure click-to-click loudness/timing variance. This removes the possibility that the symptom is a perceptual artefact or playback-chain issue.
- Add instrumentation at the `scheduleClick` level that measures the **actual** `ctx.currentTime` at the moment the browser *dispatches* the oscillator, via an `AudioWorkletNode` or `ScriptProcessorNode` listening on a tap off `masterGain` — i.e., verify what Web Audio actually played, not just what we asked it to play.
- Try replacing the oscillator-envelope click with a pre-rendered `AudioBuffer` (sample of the same click), scheduled via `AudioBufferSourceNode`. This eliminates any per-click envelope-automation variability and is closer to how professional metronomes on the web are built.
- Tighten `MAX_LATE_SEC` from 20 ms to something much smaller (3 ms?) so any stall triggers phase-preserving recovery instead of letting beats schedule in the past.

## Next-step prompt for a fresh conversation

When resuming:

1. Read this file first.
2. Confirm with the user: what are the **exact four counter values** (max |Δ|, jitter events, lateTicks, past-sched) during a session where the symptom is audible?
3. If `jitter events` is 0 or very small (< 5 over a long session) and `lateTicks` is also low → the scheduler is producing an on-grid beat stream. The problem is downstream (envelope, sample rendering, or playback chain). Pursue the "record and analyze waveform" or "AudioBuffer click" directions.
4. If `jitter events` is climbing during steady play → there's still a real scheduling issue. Add more granular logging (capture the full `recentBeats` array during an audible symptom and look at gaps vs expected grid positions).
5. Do NOT re-propose H1 or H2 without new evidence.
