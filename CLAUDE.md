# Guitar Song Practice Metronome

A web app for structured bluegrass speed-practice sessions. Drives a **three-tempo ladder** (working / target / overspeed) with a promotion rule, trouble-spot isolation, and optional audio recording. Two modes: **Songs** (full session with trouble-spot blocks) and **Exercises** (warm-up + Build/Burst/Cool Down, or `openEnded` count-up). Each song and exercise also carries a per-item `practiceMode` (`smart` = the default ladder; `simple` = a single steady-BPM block at workingBpm for the chosen length, like a regular metronome with a stop timer), an `includeWarmupBlock` flag that toggles the slow Conscious Practice prefix, and a `blockTemplate` that lets the user toggle, reorder, and reweight the timed blocks of the smart ladder. **Free Play** (`/free-play`) is an ad-hoc timer not tied to any item — time accrues to global stats under `__freeplay__`.

**Out of scope for v1**: no accounts/backend/sync, no rotation engine, no persistent recordings, no audio ML, no PWA.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS (desktop-first, dark theme) |
| State | Zustand |
| Persistence | JSON files in `data/` via Next.js API routes, behind a `Repository` interface |
| Metronome | Raw Web Audio API with a look-ahead scheduler |
| Audio capture | MediaRecorder API (ephemeral, in-memory only) |
| Tests | Vitest — tempo math, block sums, driver state machine, stats aggregates |
| Charts | recharts + hand-rolled CSS grid heatmap |

## Architecture map

```
src/
  app/                        Next.js App Router pages
    page.tsx                  Home — Songs / Exercises tabs
    songs/new/page.tsx        Add song form
    songs/[id]/page.tsx       Song detail — edit, start session, recording panel
    session/[id]/page.tsx     Live song session
    exercises/new/page.tsx    Add exercise form
    exercises/[id]/page.tsx   Exercise detail — edit, start session
    exercise-session/[id]/page.tsx  Live exercise session
    settings/page.tsx         Global settings + Danger zone
    stats/page.tsx            Global stats dashboard
    method/page.tsx           Static method explanation + Blackberry Blossom example
    free-play/page.tsx        Free Play / Transcribe — ad-hoc count-up with optional metronome
  components/                 UI components grouped by area (metronome, session, songs, exercises, stats)
  lib/
    metronome/                Pure Web Audio scheduler and click voices
    session/                  Pure session logic — blocks, driver state machine, tempo math
    stats/                    Pure aggregate fns over SessionRecord[]
    audio/                    MediaRecorder wrapper
    db/                       Repository interface + FileRepository + Dexie adapter
    store/                    Zustand stores wired to the repository
  types/                      Shared TS types
```

**Persistence seam**: everything talks to `Repository` (src/lib/db/repository.ts), never HTTP directly. `FileRepository` proxies through Next.js API routes backed by JSON files in `data/`. Atomic write-then-rename + per-file mutex in `src/lib/db/fileStore.ts`.

**Exercises** reuse the song session pipeline via `lib/session/exerciseAdapter.ts:exerciseAsSong(e)` — the driver, metronome, recorder, and all session UI take a `Song`, so the exercise page wraps its `Exercise` as a Song-shaped runtime object. Exercise blocks are built by `lib/session/exerciseBlocks.ts`.

## Key types

```ts
type Song = {
  id: string; title: string; link: string | null;
  workingBpm: number;
  warmupBpm: number | null;     // null = ⅓ × workingBpm
  troubleSpots: TroubleSpot[]; // 0–5; each drives its own Trouble Spot block + independent ladder (smart mode only)
  originalBpm: number | null;  // display-only, never used by session math
  stepPercent: number;         // default 2.5
  practiceMode: "smart" | "simple"; // default smart; simple = one Steady-BPM block, no ladder, no trouble spots
  includeWarmupBlock: boolean; // default true; when false, skip the Conscious Practice prefix
  blockTemplate?: SongBlockTemplate; // smart-mode block sequence; backfilled to default on read for legacy rows
  totalPracticeSec: number;
  createdAt: string; updatedAt: string;
};

type SongBlockTemplateEntry = {
  kind: "slowReference" | "troubleSpot" | "ceilingWork" | "overspeed" | "consolidation";
  enabled: boolean;
  weight: number; // relative duration share; allocated as (weight / totalEnabledWeight) * minutes * 60
};

type Settings = {
  recordingEnabled: boolean;   // default true
  metronomeVolume: number;     // 0..1, default 0.8
  accentsEnabled: boolean;     // default true
  autoAdvanceBlocks: boolean;  // default false
  interSongPauseSec: number;   // default 20; governs both songs AND exercises (legacy name)
  defaultPracticeMode: "smart" | "simple"; // default smart; seeds practiceMode on new songs/exercises
  defaultSongBlockTemplate: SongBlockTemplate;     // seeds blockTemplate on new songs
  defaultExerciseBlockTemplate: ExerciseBlockTemplate; // seeds blockTemplate on new exercises
};
```

Exercise type: `src/types/exercise.ts`. Key fields: `sessionMinutes` (5–60, default 5), `openEnded: boolean` (collapses to unbounded count-up at workingBpm), `metronomeEnabled: boolean`, `practiceMode`, `includeWarmupBlock`, and `blockTemplate` (same semantics as on `Song`; ignored when `openEnded` is true). Exercise template kinds: `exerciseBuild`, `exerciseBurst`, `exerciseCoolDown`.

Trouble spots integrate into the smart ladder via the `troubleSpot` row in the template — its allocated seconds are split evenly across all spots. Total session length always equals `minutes * 60` regardless of spot count or which blocks are enabled; disabling a row redistributes its time across the remaining enabled rows.

**Recordings are NOT persisted.** Latest blob lives in `useSessionStore.latestRecording`, dies on next session start or reload.

## Tempo math

- `step(bpm, pct) = round(bpm * (1 + pct/100))` — uses integer scaling (`scale = 1_000_000`) to avoid float rounding bugs.
- `targetBpm = step(workingBpm)`, `overspeedBpm = step(targetBpm)`.
- `slowReferenceBpm = round(workingBpm * 0.80)`, `consolidationBpm = round(workingBpm * 0.70)`. (Legacy `slowMusical` block was merged into `consolidation` in v10.)
- Derived tempos are **never stored** — always recomputed from `workingBpm` in `lib/session/tempo.ts`.
- `buildBlocks(minutes, song)` — song block entry point. Branches on `song.practiceMode`: `simple` returns a single timed `simpleMetronome` block at workingBpm; `smart` consumes `song.blockTemplate` (resolved via `songTemplate(song)`, falling back to `DEFAULT_SONG_BLOCK_TEMPLATE`) and allocates `minutes * 60` seconds proportionally across enabled rows. Residual rounding lands on `ceilingWork` when present. `troubleSpot` rows replicate per spot, sharing the row's allocation. The unbounded `CONSCIOUS_PRACTICE_BLOCK` is prepended only when `song.includeWarmupBlock !== false`. Per-kind `BlockDef` factories live in `SONG_BLOCK_FACTORIES`. There is no longer a 5-minute compact special-case — all session lengths run the user's template scaled to fit.
- `buildExerciseBlocks(exercise)` — exercise block entry point. Branches in priority order: `openEnded` → single unbounded count-up; otherwise `practiceMode === "simple"` → optional Conscious + a single timed Steady-BPM block; else (smart) → optional Conscious + the exercise's `blockTemplate` allocated proportionally (default = Build 180 / Burst 90 / Cool Down 30, matching the legacy 5-min default). Residual rounding lands on `exerciseBuild` when present.
- Schema migration: Dexie is at version **10**. v10 rewrites any legacy `slowMusical` entries in song `blockTemplate` and `settings.defaultSongBlockTemplate` into `consolidation` (folding weights and ORing `enabled` if both kinds appear) — the union no longer contains `slowMusical`. v9 backfills `blockTemplate` on legacy songs and exercises with the canonical default, and adds `defaultSongBlockTemplate` / `defaultExerciseBlockTemplate` to the settings singleton. v8 backfills `practiceMode = "smart"` and `includeWarmupBlock = true`. The JSON-file path lazily applies the same `slowMusical → consolidation` rewrite on read via `migrateSongTemplate` in `FileRepository.normalizeSong` / `normalizeSettings`.

## Metronome

Look-ahead scheduler: 25ms JS tick, 100ms audio-time horizon. Two architectural decisions worth knowing:

- **Pre-rendered `AudioBuffer`s**: all four click voices and the transition chime are pre-rendered once and cached per `AudioContext`. Prevents per-call synthesis variability that made accents-off mode sound randomly accented. See `METRONOME-BUG-LOG.md`.
- **Drift recovery is load-bearing**: if the JS tick fires >20ms late (GC, backgrounded tab), the beat backlog is dropped and `nextBeatTime` re-anchored. Without this, past-timestamp beats fire simultaneously and sound like accents.

`AudioContext` must be created from a user gesture (the Start Session button).

## Block instructions

All on-screen per-block guidance lives in the `INSTRUCTIONS` map at the top of `lib/session/blocks.ts`.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run test
```

## Assistant behavior directives

### Always update CLAUDE.md after finishing work

After completing any task that changes architecture, data model, schema version, block flow, file layout, or any other documented fact, **update CLAUDE.md** — don't wait to be asked. Skip the update for typo fixes or contained refactors with no doc impact.

### When to use the `debugger` subagent

Invoke for root-cause work: bug reports, unexpected behavior, test failures whose cause isn't obvious, regression hunts, race conditions in the scheduler or driver state machine. Skip for feature work or "how does X work" questions.

The agent's production-server techniques don't apply here — guide it toward fault-localization steps 1–6 and client-side bug patterns.

### When to use the `senior-fullstack` skill

Invoke for frontend architecture decisions, cross-file code-quality reviews, or picking patterns for new subsystems.

Don't invoke for its `scripts/` (assume Prisma/Postgres). This project's conventions — Zustand, Repository, pure session/tempo modules, Web Audio scheduler — take precedence over generic patterns the skill recommends.

## Design record

- In-app method: `/method` (`src/app/method/page.tsx`)
- Full design record: [swirling-swimming-owl.md](C:/Users/Yosi/.claude/plans/swirling-swimming-owl.md)

## Quality assurance

- **Linting**: ESLint config (`.eslintrc.json`) uses Next.js core-web-vitals preset.
- **Testing**: Vitest suite covers 174 tests across 9 test files (tempo math, session state, manual logging, stats aggregates, form validation).
- **Build**: Next.js production build tested and passing, all routes compile cleanly.

## Pointers for future work

- **Cloud sync**: implement `src/lib/db/cloudRepository.ts` behind `Repository`, swap in `getRepository()`. Nothing else changes.
- **Persistent recordings**: add a `recordings` table, write blobs on session end, replace single-slot `latestRecording` in `useSessionStore`.
- **PWA**: `next-pwa` once the core loop is stable.
