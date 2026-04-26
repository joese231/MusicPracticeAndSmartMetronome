# Guitar Song Practice Metronome

A web app that drives structured bluegrass speed-practice sessions. The app owns the tempo ladder, the block timer, and the metronome — and otherwise stays out of the player's way.

## What this project is

A live-session driver for a specific practice method: short, structured sessions built around a **three-tempo ladder** (working / target / overspeed), a **three-clean-reps promotion rule**, and **trouble-spot isolation**. The player adds songs manually; the app runs customizable-length sessions (5 min compact or 10–60 min base, scaled proportionally from the 10-min template) against a running metronome, promotes tempos when the player taps "I earned it", and records the session audio in memory for immediate playback.

A second mode — **Exercises** — runs technique drills (scales, arpeggios, picking patterns) at a customizable session length (5–60 min, default 5, saved per exercise). Same warm-up + metronome + recorder, but a slimmer block flow: Conscious Practice (unbounded) → Build (working) → Burst (1.5 min @ overspeed) → Cool Down (30 sec @ ~77% of working). Burst (90s) and Cool Down (30s) are fixed; the Build block absorbs all extra time. Only Build earns. The Cool Down deliberately ends below working tempo to release tension and leave the player on a clean memory rep.

The full method is explained in-app at `/method`. The authoritative design record is [swirling-swimming-owl.md](C:/Users/Yosi/.claude/plans/swirling-swimming-owl.md).

## Core decisions (what's in, what's out)

**In scope**
- Manually-managed song list with title, optional link, working BPM, 0–5 trouble spots (each with its own optional starting BPM), optional original-recording BPM, per-song step %
- Customizable session length: 5-min compact form (fixed, no trouble-spot blocks), or 10–60 min base length that proportionally scales the canonical 10-min template
- A **Conscious Practice** warm-up runs first in every session regardless of length. Unbounded (no countdown) — the player ends it with `N` / Finish warm-up when ready. Metronome plays the song/exercise's saved `warmupBpm` if set, else ⅓ × `workingBpm` (floored at 20). A **Set BPM…** editor (with Reset-to-default) writes through to `warmupBpm` and persists across sessions; a **2× slower** toggle halves whatever the warm-up would otherwise play and stays session-local (resets on block advance)
- Each trouble spot contributes one additional Trouble Spot block to the session and adds its scaled duration to the total — more spots means a longer session, not a more-crowded one
- Percentage-based tempo promotion (default 2.5%, editable per song)
- "I earned it" button promotes working BPM (Ceiling Work block) or the specific spot's BPM (Trouble Spot blocks) persistently, each trouble spot on its own independent ladder
- Metronome with all-beats (default) / backbeat 2&4 toggle, live on the session page
- Global settings: recording on/off (default ON), metronome accents on/off (default ON), volume
- Ephemeral session-wide audio recording — in-memory only, single "latest recording" slot
- Per-block on-screen instructions
- 1-second inter-block transition with a two-note chime
- Method page with Blackberry Blossom worked example
- Keyboard shortcuts: `Space` = I earned it, `N` = skip block, `Esc` = end session

**Out of scope for v1**
- No accounts, backend, or multi-device sync
- No rotation engine, no "due for practice" list, no twice-a-day warnings
- No end-of-block self-check prompts (Earned/Close/Tense/Rough)
- No persistent recording storage — recordings die on new session or page reload
- No auto-flub detection or audio ML
- No PWA / offline install

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS (desktop-first, dark theme default) |
| State | Zustand |
| Persistence | JSON files in `data/` (`songs.json`, `exercises.json`, `settings.json`, `sessions.json`) via Next.js API routes, behind a `Repository` interface — swappable for a cloud adapter later. Dexie/IndexedDB code is kept only as a one-time migration source for users upgrading from the old browser-storage build. |
| Metronome | Raw Web Audio API (`AudioContext`) with a look-ahead scheduler |
| Audio capture | MediaRecorder API (ephemeral, in-memory only) |
| Tests | Vitest — focused on tempo math, block sums, driver state machine, and stats aggregates |
| Charts | recharts (`^2`) for line + bar; calendar heatmap is hand-rolled CSS grid |

## Architecture map

```
src/
  app/                        Next.js App Router pages
    page.tsx                  Home — Songs / Exercises tabs
    songs/new/page.tsx        Add song form
    songs/[id]/page.tsx       Song detail — edit form, start session, latest recording panel
    session/[id]/page.tsx     Live song session — the driver UI
    exercises/new/page.tsx    Add exercise form
    exercises/[id]/page.tsx   Exercise detail — edit form, start session at saved length
    exercise-session/[id]/page.tsx  Live exercise session — length from exercise.sessionMinutes
    settings/page.tsx         Global settings
    stats/page.tsx            Global stats dashboard — calendar heatmap, daily minutes, promotion velocity
    method/page.tsx           Static method explanation + Blackberry Blossom example
  components/                 UI components grouped by area (metronome, session, songs, exercises, stats)
  lib/
    metronome/                Pure Web Audio scheduler and click voices
    session/                  Pure session logic — blocks, driver state machine, tempo math
    stats/                    Pure aggregate fns over SessionRecord[] — byDayMinutes, bpmTimeline, promotionVelocity, stalledSongs
    audio/                    MediaRecorder wrapper
    db/                       Repository interface + Dexie adapter
    store/                    Zustand stores wired to the repository
  types/                      Shared TS types
```

**The persistence seam**: everything talks to `Repository` (src/lib/db/repository.ts), never the file/HTTP layer directly. The current implementation is `FileRepository` (src/lib/db/fileRepository.ts) which proxies through Next.js API routes (`/api/songs`, `/api/exercises`, `/api/settings`, `/api/sessions`) backed by JSON files in `data/`. Server-side IO goes through `src/lib/db/fileStore.ts` (atomic write-then-rename + per-file mutex). To add cloud sync later, drop in `cloudRepository.ts` behind the same interface.

**Legacy IndexedDB path**: `LocalRepository` (Dexie) is retained only for the one-time migration that runs on app boot via `src/components/BootMigration.tsx` → `migrateFromIndexedDB.ts`. It reads any pre-existing IndexedDB rows and POSTs them to `/api/migrate`, which only writes JSON files when they're empty/missing. Guarded by `localStorage["gspm:migrated-to-files"]` so it runs once per browser. IndexedDB is left intact (not deleted) so the user can verify before discarding.

**Exercises reuse the song session machinery via a one-way adapter** (`lib/session/exerciseAdapter.ts:exerciseAsSong(e)`). The driver, metronome, recorder, every `BlockDef.tempoFn`, and every session UI subcomponent take a `Song`, so the exercise session page wraps its `Exercise` as a Song-shaped runtime object and lets the rest of the pipeline run unchanged. Promotion is detected the same way (`promotes.kind === "working"`) but the exercise session writes back to `useExercisesStore` instead of `useSongsStore`. The exercise block list is built by `lib/session/exerciseBlocks.ts:buildExerciseBlocks(minutes)` — always warm-up + Build + Burst + Cool Down. Burst (90s) and Cool Down (30s) are fixed; Build absorbs the rest of `minutes * 60`. The minutes value lives on the exercise as `sessionMinutes` (default 5, range 5–60) and is clamped by the builder.

## Data model

```ts
type TroubleSpot = {
  bpm: number | null;           // optional starting BPM; null falls back to slowReferenceBpm
};

type Song = {
  id: string;
  title: string;
  link: string | null;
  workingBpm: number;           // user input — the full-tune earned tempo
  warmupBpm: number | null;     // saved Conscious Practice BPM; null = ⅓ × workingBpm rule
  troubleSpots: TroubleSpot[];  // 0..5 — each one drives its own Trouble Spot block + ladder
  originalBpm: number | null;   // optional — display-only reference, never used by session math
  stepPercent: number;          // default 2.5
  totalPracticeSec: number;     // the only stat tracked
  createdAt: string;
  updatedAt: string;
};

type Settings = {
  recordingEnabled: boolean;    // default true
  metronomeVolume: number;      // 0..1, default 0.8
  accentsEnabled: boolean;      // default true
};
```

Derived tempos (`targetBpm`, `overspeedBpm`, `slowReferenceBpm`, `slowMusicalBpm`, `troubleBlockBpmFor`) are **never stored** — always computed from `workingBpm` and the `troubleSpots` array in `lib/session/tempo.ts`. This is a load-bearing invariant: the consolidation block automatically runs at the just-promoted working tempo because its `tempoFn` reads live song state, and each trouble block's `tempoFn` closes over its own spot index.

The Dexie schema is versioned: v2 migrates the legacy `troubleBpm: number | null` field to `troubleSpots: TroubleSpot[]` — a non-null legacy value becomes a single-element array. v3 adds `sortIndex` on songs. v4 adds the `exercises` table. v5 backfills `sessionMinutes: 5` on existing exercises. v6 backfills `warmupBpm: null` on existing songs and exercises.

**Recordings are NOT persisted.** The most recent session's blob lives in `useSessionStore.latestRecording` and dies on the next session start or page reload. The recording's `songId` field holds whichever id ran the session — song or exercise. Detail pages filter by id-match, so the same single-slot store serves both modes.

**Session history (`sessions.json`)**: every completed or aborted session appends one `SessionRecord` (src/types/sessionRecord.ts) via `Repository.appendSession` → `POST /api/sessions`. A record captures denormalized item title, start/end ISO timestamps, wall-clock `durationSec`, `endedReason`, planned minutes, start/end `workingBpm`, start/end per-trouble-spot BPMs (songs only), and a chronological `promotions: PromotionEvent[]` list. Capture happens in the session pages: `startSession` snapshots starting state into refs, `handleEarned` pushes each promotion into `promotionsRef`, and `endSession` builds the record after `incrementPracticeTime` and posts it best-effort (failure never blocks teardown). The POST endpoint dedupes on record `id` so retries are idempotent. The history feeds `useSessionHistoryStore`, read by `BpmTimelineChart` / `RecentSessionsList` on song & exercise detail pages and by the global `/stats` page (heatmap, daily-minutes bars, promotion-velocity table). Pure aggregate fns live in `src/lib/stats/aggregate.ts` with Vitest coverage in the sibling `.test.ts`.

**Exercise data model** — `src/types/exercise.ts`:

```ts
type Exercise = {
  id: string;
  name: string;
  link: string | null;
  notes: string | null;          // short free text
  workingBpm: number;
  warmupBpm: number | null;      // saved Conscious Practice BPM; null = ⅓ × workingBpm rule
  stepPercent: number;           // default 2.5
  sessionMinutes: number;        // default 5, range 5..60 — total metronome-on time
  totalPracticeSec: number;      // the only stat tracked
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};
```

No trouble spots. No `originalBpm`. Stored in Dexie `exercises` table (schema v5). All CRUD goes through `Repository.{listExercises, getExercise, upsertExercise, deleteExercise, reorderExercises}`. The session length lives on the exercise itself — there's no per-session override or query param; editing the field in the form is what changes the next session's length.

## Session flow

1. User picks a session length on a song's detail page (preset chip 5/10/15/20/30 or a custom value 5–60) and taps **Start**. The chosen base length is passed as `?minutes=N`.
2. `session/[id]/page.tsx` clamps the `minutes` query param, builds the block list via `buildBlocks(minutes, song)` (which always prepends the unbounded `CONSCIOUS_PRACTICE_BLOCK`), creates a `Metronome` instance, starts the recorder (if enabled), and drives the block sequence via the pure state machine in `lib/session/driver.ts`.
3. The driver has three phases: `playing`, `awaiting`, `ended`. Timed blocks flip `playing → awaiting` when the countdown expires; the chime plays and the metronome keeps clicking at the current tempo so the player can finish their pass. Pressing `Space` / Continue advances to the next block. **Unbounded blocks never auto-flip** — `tickSnapshot` skips them and they stay in `playing` until `advanceSnapshot` is called explicitly (via `N` / Finish warm-up).
4. During `ceilingWork` and `troubleSpot` blocks, the **I earned it** button is visible. Tap (or `Space`) promotes the relevant BPM via `promoteWorking` / `promoteTroubleAt(song, index)`, persists the song, and the metronome jumps to the new tempo phase-preserving. Each trouble block's `promotes` is a discriminated union `{ kind: "trouble", index }` so the session page routes the promotion to the right spot.
5. Session ends when the driver advances past the last block, or on `Esc`. `song.totalPracticeSec` increments by elapsed wall-clock seconds (warm-up time included). Recorder stops and hands its blob to `useSessionStore.latestRecording`. User is routed to the song detail page where the blob plays back in a native `<audio controls>` panel.

## Tempo math invariants

- Only `workingBpm` and each trouble spot's `bpm` are stored.
- `step(bpm, pct) = round(bpm * (1 + pct/100))` is the single promotion primitive. Implemented via integer scaling (`scale = 1_000_000`) to dodge float rounding bugs — `220 * 1.025` otherwise comes out as 225.499… and would round the wrong way.
- `targetBpm = step(workingBpm)`, `overspeedBpm = step(targetBpm)` (two steps up).
- `slowReferenceBpm = round(workingBpm * 0.77)`, `slowMusicalBpm = round(workingBpm * 0.72)`.
- `troubleBlockBpmFor(song, index) = song.troubleSpots[index]?.bpm ?? slowReferenceBpm(song)`.
- `buildBlocks(minutes, song)` is the one entry point for block generation. It always prepends `CONSCIOUS_PRACTICE_BLOCK` (`unbounded: true`, `durationSec: 0`). `minutes === 5` then appends `FIVE_MIN_BLOCKS` unchanged; otherwise it scales `BASE_TEN_MIN_BLOCKS` by `minutes / 10`, replaces the canonical single Trouble Spot block with one block per `song.troubleSpots` entry, and absorbs any rounding residual into the Ceiling Work block so totals match `sessionLengthSec(minutes, song)` exactly. `sessionLengthSec` does **not** include the warm-up — it's the metronome-on time of the timed blocks only.
- Unbounded blocks (`BlockDef.unbounded === true`) are a distinct block shape: `durationSec` is ignored, `timeLeftInPlayingSec` returns `Infinity`, and `tickSnapshot` never auto-transitions them. The session page branches on `currentBlock.unbounded` to render `BlockCountUp` instead of `BlockCountdown` and a "Finish warm-up →" button instead of `EarnedButton`.
- `originalBpm` is display-only. **Never** consumed by session math.

## Metronome notes

- Look-ahead scheduler pattern (Chris Wilson's "A Tale of Two Clocks"): 25ms JS tick, 100ms audio-time look-ahead horizon. Beats scheduled via `AudioBufferSourceNode.start(exactTime)`, never `setTimeout`.
- Four click voices (`lib/metronome/click.ts`):
  - **Accent** (1500 Hz) — backbeat 2 & 4 in backbeat mode with accents ON
  - **Downbeat** (1200 Hz) — beat 1 in all-beats mode with accents ON
  - **Tick** (900 Hz) — beats 2/3/4 in all-beats mode with accents ON
  - **Uniform** (1100 Hz) — every played beat when accents are OFF
- **Each voice is pre-rendered once as an `AudioBuffer` and cached per `AudioContext`** (`WeakMap<AudioContext, Map<string, AudioBuffer>>`). Every click of a given voice is byte-identical sample data — no per-call oscillator+envelope graph. Prevents per-call Web Audio parameter-automation variability from making "accents-off" mode sound randomly accented (see `METRONOME-BUG-LOG.md`). `Metronome.ensureContext()` calls `prewarmClickBuffers(ctx)` so the first beat pays no synthesis cost. Same approach is used for the two transition-chime notes.
- Modes: **all-beats** (default) clicks 1-2-3-4; **backbeat** clicks only 2 & 4.
- Tempo changes are phase-preserving: on BPM change, `nextBeatTime = max(nextBeatTime, currentTime + 0.05)` — no glitch.
- **Drift recovery is load-bearing.** The 25 ms `setInterval` is not real-time — under main-thread stalls (React renders, RAF work, GC, backgrounded tabs) it can fire tens or hundreds of ms late, pushing `nextBeatTime` well behind `ctx.currentTime`. Without a guard, the catch-up `while` loop would schedule every missed beat with an already-past timestamp, and per Web Audio spec `osc.start(pastTime)` starts the oscillator **immediately** — so the queued beats all fire at once and sum through the shared `masterGain` into a single fatter "accented"-sounding transient. `Metronome.tick()` calls `recoverFromDrift(nextBeatTime, now)` at the top: if we're >20 ms behind, the backlog is dropped and `nextBeatTime` re-anchored to `now + 0.05`. The count surfaces as `lateTickCount` in `MetronomeDiagnostics` (visible with `?debug=1`).
- `AudioContext` must be created from a user gesture — the Start Session button is that gesture.
- Two-note transition chime (880 + 1320 Hz, ~250ms) via `playTransitionCue()`, routed through the same master gain as the metronome.

## Block instructions

All on-screen per-block guidance lives in **one place**: the `INSTRUCTIONS` map at the top of `lib/session/blocks.ts`. Edit that file to change the copy. Each block pulls from `INSTRUCTIONS[kind]`.

## Keyboard shortcuts

Surfaced on the session screen via `ShortcutsHint.tsx` at the bottom of the page. Same bindings on song and exercise sessions:

- `Space` — advance to the next block (or out of `awaiting`)
- `+` — promote the relevant BPM (only active during blocks where the earn button is visible)
- `P` — pause / resume
- `R` — reset the current block's countdown and realign the metronome to a downbeat
- `Esc` — end session early (recording still delivered up to that point)

## Commands

```bash
npm install         # first time
npm run dev         # http://localhost:3000
npm run build       # production build
npm run test        # run the Vitest suite
```

## Assistant behavior directives

These directives shape how Claude approaches work in this repo. They reference tools installed under `.claude/`.

### Always update CLAUDE.md after finishing work

After completing any task that changes architecture, data model, schema version, block flow, file layout, dependencies, commands, or any other fact documented in this file, **update CLAUDE.md as part of finishing the task** — don't wait to be asked. The doc is load-bearing context for future sessions; stale claims here are worse than no claims. If the change has no impact on what's documented (e.g., a typo fix, a contained refactor, a test-only edit), skip the update and say so.

### When to use the `debugger` subagent

Invoke the `debugger` subagent (via the Agent tool) for any task that is root-cause work, not implementation work:

- A bug report or reproduction ("X is broken", "Y crashes", "this throws")
- Unexpected behavior ("why does the metronome drift after tempo changes?")
- Test failures whose cause isn't obvious from the error alone
- Regression hunts ("this used to work before commit Z")
- Race conditions or timing bugs — the scheduler and driver state machine are the hot spots

Skip it for straight feature work, refactors, or questions that are clearly about "how does X work" rather than "why is X wrong."

The agent's production-server techniques (distributed traces, heap dumps, log aggregation) don't apply to this client-side app — the parts that do apply are the fault-localization decision tree (steps 1–6) and the common bug patterns. Guide the agent accordingly.

### When to use the `senior-fullstack` skill

Invoke the `senior-fullstack` skill (via the Skill tool) for:

- Frontend architecture decisions (component boundaries, state shape, Next.js App Router patterns)
- Code-quality reviews across multiple files
- Picking patterns for new subsystems (where does this logic live?)

Do **not** invoke it for:

- Backend / API / database / ORM work — this app has none
- Docker, K8s, cloud deploy, CI/CD — out of scope for v1
- The skill's `scripts/` (fullstack_scaffolder.py, etc.) — they assume a Prisma/Postgres stack that this project doesn't use

Treat its `references/` docs as advisory, not prescriptive — this project's conventions (Zustand, Dexie-behind-Repository, pure session/tempo modules, Web Audio scheduler) take precedence over any generic pattern the skill recommends.

## The method itself

- In-app: [`/method`](src/app/method/page.tsx) — authoritative explanation + Blackberry Blossom worked example.
- Original spec and full design record: [swirling-swimming-owl.md](C:/Users/Yosi/.claude/plans/swirling-swimming-owl.md)

## Pointers for future work

- To add cloud sync: implement `src/lib/db/cloudRepository.ts` behind the `Repository` interface and swap the `FileRepository` constructor in `getRepository()` (src/lib/db/localRepository.ts). Nothing else in the app should need to change.
- To persist recordings: add a `recordings` table to Dexie, write blobs on session end, and replace the single-slot `latestRecording` in `useSessionStore` with a query. The recording ephemerality is intentional for v1 — revisit only if requested.
- To add a PWA: `next-pwa` once the core loop is stable.
