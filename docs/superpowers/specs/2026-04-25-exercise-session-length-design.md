# Exercise Session Length — Design

**Date:** 2026-04-25
**Status:** Approved, ready for implementation plan

## Problem

Exercise sessions are hardcoded to 5 minutes (Build 3:00 / Burst 1:30 / Cool Down 0:30). Some drills warrant longer focused work. Players need to set a longer length and have it remembered for next time, without re-choosing on every start.

## Solution overview

Make session length a per-exercise saved property. Default 5 minutes, editable in the exercise form, range 5–60. The Build block absorbs all extra time; Burst and Cool Down stay fixed.

## Data model

Add one field to `Exercise` (`src/types/exercise.ts`):

```ts
sessionMinutes: number;  // 5..60, default 5
```

Dexie schema bumps to **v5** with a migration that backfills existing rows with `sessionMinutes: 5`. New exercises created via `useExercisesStore.addExercise` default to 5 if not provided.

## Block math

Replace `EXERCISE_BLOCKS` (constant) and `EXERCISE_SESSION_SEC` (constant) with a parameterized builder in `src/lib/session/exerciseBlocks.ts`:

```
buildExerciseBlocks(minutes: number): BlockDef[]
```

Composition:
- Burst: **always 90s**
- Cool Down: **always 30s**
- Build: `minutes * 60 - 120` seconds (always ≥ 180s because `minutes ≥ 5`)
- Always prepended by `CONSCIOUS_PRACTICE_BLOCK`

The block kinds, labels, `tempoFn`s, `promotes`, and `instructions` are unchanged from the current 5-min layout.

`EXERCISE_SESSION_SEC` is removed. Anything that needs a total computes it from `minutes * 60`.

## Form

`src/components/exercises/ExerciseForm.tsx` gains one input:

- **Session length (minutes)** — number input, min=5, max=60, step=1, default=5
- Sits next to the step % field
- Plumbed through `initial`/`onSubmit` like the other fields

## Detail page

`src/app/exercises/[id]/page.tsx`:

- Add `Stat label="Length" value="${exercise.sessionMinutes} min"` to the stats row
- Button text: `Start ${exercise.sessionMinutes}-min session`
- Update the descriptive sentence to use computed durations: e.g. for 10 min → "8 min Build · 1.5 min Burst · 30 sec Cool Down"

## Exercise session page

`src/app/exercise-session/[id]/page.tsx`:

- Reads `exercise.sessionMinutes`, calls `buildExerciseBlocks(exercise.sessionMinutes)`
- No `?minutes=` query param — the value lives on the exercise

## Tests

Add to existing exercise-blocks Vitest suite:

- `buildExerciseBlocks(5)` → total 300s, Build 180, Burst 90, Cool Down 30
- `buildExerciseBlocks(10)` → total 600s, Build 480, Burst 90, Cool Down 30
- `buildExerciseBlocks(30)` → total 1800s, Build 1680, Burst 90, Cool Down 30
- `buildExerciseBlocks(60)` → total 3600s, Build 3480, Burst 90, Cool Down 30
- All variants always start with the unbounded `CONSCIOUS_PRACTICE_BLOCK`

## Out of scope

- Per-session override on detail page (chips, query param) — length is a saved property
- Length-as-property on songs (songs already have per-session chips; separate feature)
- Trouble-spot equivalents for exercises (exercises have no trouble spots)
