# Guitar Song Practice Metronome

A web app for structured bluegrass speed-practice sessions. Drives a **three-tempo ladder** (working / target / overspeed) with a promotion rule, trouble-spot isolation, and optional audio recording. Two item types: **Songs** and **Exercises**. Each song and exercise carries a per-item `practiceMode` (`smart`, `simple`, `timed`, or `openEnded`), an `includeWarmupBlock` flag that toggles the slow Conscious Practice prefix, a saved session length, and a customizable `blockTemplate` for smart practice. Smart templates are ordered recipes: users can add/remove/reorder blocks, name them, describe their purpose, choose fixed minutes or percentage-of-remaining duration, pick tempo rules, toggle per-block metronome, and decide whether the block promotes working/trouble BPM. **Free Play** (`/free-play`) is an ad-hoc timer not tied to any item — session records use `itemKind: "freePlay"` with `itemId: "__freeplay__"`, and time accrues to global stats without counting as a song or exercise item.

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
    session/                  Pure session logic/runtime — blocks, driver state machine, tempo math, shared live-session hook
    stats/                    Pure aggregate fns over SessionRecord[]
    audio/                    MediaRecorder wrapper
    db/                       Repository interface + FileRepository + Dexie adapter
    store/                    Zustand stores wired to the repository
  types/                      Shared TS types
```

**Persistence seam**: everything talks to `Repository` (src/lib/db/repository.ts), never HTTP directly. `FileRepository` proxies through Next.js API routes backed by JSON files in `data/`. Atomic write-then-rename + per-file mutex in `src/lib/db/fileStore.ts`. Read-modify-write API handlers must use `updateJsonAtomic(...)` so the read, mutation, and rename happen under the same per-file lock; plain `readJson()` + `writeJsonAtomic()` is only safe for full-file replacement with no dependency on the prior contents. JSON write APIs validate payloads before writing. Normal song/exercise edits use item-level PATCH routes with `expectedUpdatedAt` optimistic concurrency, delete routes, and reorder routes that only mutate `sortIndex`; broad collection PUTs are validated legacy/bulk paths and are not used by normal Repository mutations. Live song/exercise session completion uses `Repository.completeSession()` / `POST /api/sessions/complete` so the session record append and latest item total increment happen in one server request, deduped by session id. Trim/delete rollbacks and other practice-time changes use `Repository.adjustPracticeTime()` / `PATCH /api/practice-time` so signed deltas apply to the latest persisted item row instead of replacing a stale client snapshot. `practice-time.json` is a best-effort song total mirror and must be cleared alongside session history during statistics resets/factory resets.

**Exercises** share the song session runtime through `lib/session/usePracticeSession.ts` and `components/session/SessionShell.tsx`. Tempo-facing code depends on the smaller `TempoSubject` shape from `lib/session/runtimeTypes.ts`; `lib/session/exerciseAdapter.ts:exerciseAsSong(e)` remains as a compatibility wrapper for legacy Song-shaped UI/runtime fields. Exercise blocks are built by `lib/session/exerciseBlocks.ts`.

## Key types

```ts
type Song = {
  id: string; title: string; link: string | null;
  workingBpm: number | null;   // null allowed for no-metronome timed/open-ended songs
  warmupBpm: number | null;     // null = ⅓ × workingBpm
  troubleSpots: TroubleSpot[]; // 0–5; each drives its own Trouble Spot block + independent ladder (smart mode only)
  originalBpm: number | null;  // display-only, never used by session math
  stepPercent: number;         // default 2.5
  practiceMode: "smart" | "simple" | "timed" | "openEnded";
  includeWarmupBlock: boolean; // default true; when false, skip the Conscious Practice prefix
  blockTemplate?: SongBlockTemplate; // smart-mode block sequence; backfilled to default on read for legacy rows
  defaultSessionMinutes: number; // saved per-song countdown length, default 10
  metronomeEnabled: boolean;     // used by timed/open-ended song modes
  totalPracticeSec: number;
  createdAt: string; updatedAt: string;
};

type SmartBlockRecipe = {
  id: string;
  role: "slowReference" | "troubleSpot" | "ceilingWork" | "overspeed" | "consolidation" |
    "exerciseBuild" | "exerciseBurst" | "exerciseCoolDown" | "custom";
  name: string;
  purpose: string;
  instructions: string[];
  enabled: boolean;
  duration: { kind: "fixed"; seconds: number } | { kind: "percent"; percent: number };
  tempoRule: TempoRule;
  metronomeEnabled: boolean;
  progression: { kind: "none" } | { kind: "working" } | { kind: "trouble" }; // trouble is valid only on song trouble-spot recipes
};

type Settings = {
  recordingEnabled: boolean;   // default true
  metronomeVolume: number;     // 0..1, default 0.8
  accentsEnabled: boolean;     // default true
  autoAdvanceBlocks: boolean;  // default false
  interSongPauseSec: number;   // default 20; governs both songs AND exercises (legacy name)
  defaultPracticeMode: "smart" | "simple" | "timed" | "openEnded";
  defaultSongSessionMinutes: number;     // default 10
  defaultExerciseSessionMinutes: number; // default 5
  defaultSongBlockTemplate: SongBlockTemplate;     // seeds blockTemplate on new songs
  defaultExerciseBlockTemplate: ExerciseBlockTemplate; // seeds blockTemplate on new exercises
};
```

`SessionRecord.itemKind` is `"song" | "exercise" | "freePlay"`. Free-play and free-form manual records use `freePlay`; item-specific lists, last-played highlights, and song/exercise total adjustments should ignore `freePlay` records.

`TempoSubject` is the shared tempo runtime shape used by `BlockDef.tempoFn`, `lib/session/tempo.ts`, and `lib/session/tempoRules.ts`. It contains only `workingBpm`, `warmupBpm`, `troubleSpots`, `originalBpm`, and `stepPercent`; use it for tempo evaluation instead of requiring a full `Song`.

Exercise type: `src/types/exercise.ts`. Key fields: `sessionMinutes` (5–60, default 5), legacy `openEnded: boolean` plus `practiceMode: "openEnded"` (either collapses to unbounded count-up at workingBpm), `metronomeEnabled: boolean` (the global metronome toggle for simple/timed/open-ended exercise modes), `includeWarmupBlock`, and `blockTemplate` (same recipe semantics as on `Song`; ignored in simple/timed/openEnded; smart exercises follow each recipe's `metronomeEnabled`). Exercise template roles: `exerciseBuild`, `exerciseBurst`, `exerciseCoolDown`, or `custom`.

Trouble spots integrate into the smart ladder via any enabled recipe with `role: "troubleSpot"`, but song trouble-spot blocks are additive: they do not count against `song.defaultSessionMinutes`. A trouble-spot block promotes only when its recipe progression says so; `progression.kind === "trouble"` is valid only for song trouble-spot recipes. The default song template is fixed-time by default: Slow Reference 1:30, Trouble Spot +2:00 per saved spot, Ceiling Work 5:00 at target BPM, Overspeed 2:00, and Consolidation 1:30. The optional Conscious Practice prefix is a count-up block outside the timed allocation. The default exercise template is also fixed-time: Build 3:30 at target BPM, Burst 1:00, and Cool Down 0:30. Duration allocation for custom templates is handled by `lib/session/duration.ts`: fixed-minute base blocks take time first, then percent blocks divide the remaining base time. The editor explains this as "percent of remaining time." Save validation rejects fixed base-block totals above the selected session length; if all enabled base blocks are fixed, their total must exactly match the selected session length. Smart session builders use the same strict duration contract and return no timed body blocks for invalid fixed-only underfill/overflow plans. Rounding residual seconds land on the first percent block.

`BlockTemplateEditor` uses collapsed recipe rows by default: the top base-duration summary, validation message, block name, duration chip, tempo label, progression label, and metronome status stay visible, while Duration/Tempo/Progression/Metronome/Instructions controls render only for the expanded row. Song Trouble Spot rows keep distinct additive styling. Keep this layout responsive; fixed-minute decimal inputs such as `1.5` must not be obscured by adjacent tempo controls.

**Recordings are NOT persisted.** Latest blob lives in `useSessionStore.latestRecording`, dies on next session start or reload.

## Tempo math

- `step(bpm, pct) = round(bpm * (1 + pct/100))` — uses integer scaling (`scale = 1_000_000`) to avoid float rounding bugs.
- `targetBpm = step(workingBpm)`, `overspeedBpm = step(targetBpm)`. Nullable song `workingBpm` is treated as `0` by `workingBpmForTempo`; forms prevent smart/simple/metronome-on songs from being saved without a BPM.
- `slowReferenceBpm = round(workingBpm * 0.80)`, `consolidationBpm = round(workingBpm * 0.70)`. (Legacy `slowMusical` block was merged into `consolidation` in v10.)
- Derived tempos are **never stored** — always recomputed from `workingBpm` and recipe `tempoRule`s. `lib/session/tempoRules.ts` evaluates tempo sources (`working`, `target`, `overspeed`, `original`, `trouble`, `fixed`) with optional percent/BPM-offset/step adjustments and fallbacks.
- `lib/session/templateBlocks.ts` holds shared smart-template filtering, duration allocation, and recipe-to-block helpers used by song and exercise builders. Song-specific additive trouble expansion stays in `lib/session/blocks.ts`; exercise instruction fallbacks stay in `lib/session/exerciseBlocks.ts`.
- `buildBlocks(minutes, song)` — song block entry point. Branches on `song.practiceMode`: `openEnded` returns one unbounded `openEnded` block; `timed` returns optional Conscious Practice plus one `timedPractice` countdown block, optionally no-metronome; `simple` returns optional Conscious Practice plus one `simpleMetronome` block at workingBpm; `smart` validates and allocates non-trouble blocks across the saved base duration, then expands additive `troubleSpot` recipes per spot. The session page reads `song.defaultSessionMinutes`; there is no one-off start duration query.
- `buildExerciseBlocks(exercise)` — exercise block entry point. Branches in priority order: legacy `openEnded` or `practiceMode === "openEnded"` → single unbounded count-up; `simple` → optional Conscious + single steady-BPM block; `timed` → optional Conscious + single `timedPractice` countdown block; otherwise smart → optional Conscious + strictly validated recipe-allocated blocks. Exercise sessions read `exercise.sessionMinutes`.
- Schema migration: Dexie is at version **14**. v14 updates previously canonical settings defaults to the fixed-time song/exercise templates while preserving customized defaults. v13 replaces the old canonical default song template in settings with the additive-trouble default while preserving customized defaults. v12 converts legacy weight templates to recipe templates, backfills `Song.defaultSessionMinutes`, `Song.metronomeEnabled`, settings default durations, and maps legacy exercise `openEnded` rows to `practiceMode: "openEnded"`. v11 rewrites any saved exercise's `exerciseBurst` weight of 90 (the legacy default) to 60 (the new default) in both `exercises` rows and `settings.defaultExerciseBlockTemplate`; user-customized weights other than 90 are preserved. v10 rewrites legacy `slowMusical` entries in song templates into `consolidation`; v9 backfills templates and settings singleton templates; v8 backfills `practiceMode = "smart"` and `includeWarmupBlock = true`. The JSON-file path lazily applies the same rewrites on read via `FileRepository.normalizeSong` / `normalizeExercise` / `normalizeSettings`.

## Metronome

Look-ahead scheduler: 25ms JS tick, 100ms audio-time horizon. Two architectural decisions worth knowing:

- **Pre-rendered `AudioBuffer`s**: all four click voices and the transition chime are pre-rendered once and cached per `AudioContext`. Prevents per-call synthesis variability that made accents-off mode sound randomly accented. See `METRONOME-BUG-LOG.md`.
- **Drift recovery is load-bearing**: if the JS tick fires >20ms late (GC, backgrounded tab), the beat backlog is dropped and `nextBeatTime` re-anchored. Without this, past-timestamp beats fire simultaneously and sound like accents.

`AudioContext` must be created from a user gesture (the Start Session button).

## Block instructions

All on-screen per-block guidance lives in the `INSTRUCTIONS` map at the top of `lib/session/blocks.ts`.

## Live session runtime

Song and exercise live-session pages share `usePracticeSession` for metronome lifecycle, recorder lifecycle, RAF ticking, driver snapshot controls, keyboard shortcuts, pause/reset/previous/repeat/skip/end wiring, and toast state. Page-specific code still owns item lookup, promotion semantics, BPM editing, between-item routing overlays, and persisted session-record construction. The main live-session layout is rendered through `SessionShell`, which uses a wrapping toolbar and `min-h-dvh`/`overflow-x-hidden` root to keep controls usable on narrow screens.

## UI components

Use `components/ui/SegmentedControl.tsx` for segmented radio-like controls. It provides radiogroup semantics and ArrowLeft/ArrowRight keyboard navigation.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run test
```

## Assistant behavior directives

### Always update AGENTS.md after finishing work

After completing any task that changes architecture, data model, schema version, block flow, file layout, or any other documented fact, **update AGENTS.md** — don't wait to be asked. Skip the update for typo fixes or contained refactors with no doc impact.

### When to use the `debugger` subagent

Invoke for root-cause work: bug reports, unexpected behavior, test failures whose cause isn't obvious, regression hunts, race conditions in the scheduler or driver state machine. Skip for feature work or "how does X work" questions.

The agent's production-server techniques don't apply here — guide it toward fault-localization steps 1–6 and client-side bug patterns.

### When to use the `senior-fullstack` skill

Invoke for frontend architecture decisions, cross-file code-quality reviews, or picking patterns for new subsystems.

Don't invoke for its `scripts/` (assume Prisma/Postgres). This project's conventions — Zustand, Repository, pure session/tempo modules, Web Audio scheduler — take precedence over generic patterns the skill recommends.

## Design record

- In-app method: `/method` (`src/app/method/page.tsx`)
- Full design record: [swirling-swimming-owl.md](C:/Users/Yosi/.Codex/plans/swirling-swimming-owl.md)

## Quality assurance

- **Linting**: ESLint config (`.eslintrc.json`) uses Next.js core-web-vitals preset.
- **Testing**: Vitest suite covers 270 tests across 34 test files (tempo math, session state, duration allocation, tempo rules, manual logging, stats aggregates, form/list validation, template validation, metronome guards, segmented controls, file-backed persistence regressions, API validation, narrow item routes, store stale-write recovery, and exercise session completion wiring).
- **Build**: Next.js production build tested and passing, all routes compile cleanly.

## Pointers for future work

- **Cloud sync**: implement `src/lib/db/cloudRepository.ts` behind `Repository`, swap in `getRepository()`. Nothing else changes.
- **Persistent recordings**: add a `recordings` table, write blobs on session end, replace single-slot `latestRecording` in `useSessionStore`.
- **PWA**: `next-pwa` once the core loop is stable.
