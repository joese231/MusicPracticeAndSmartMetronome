# Custom Practice Blocks Design

## Context

The app currently supports configurable block order and relative duration for songs and exercises, but the block kinds and tempo formulas are fixed in code. Songs have `smart` and `simple` practice modes, while exercises also support `openEnded` and `metronomeEnabled`.

The new design makes Smart Practice fully user-configurable for both songs and exercises. Users can keep the current bluegrass ladder, change its tempo methodology, or build a different practice structure with their own blocks.

## Goals

- Let users create, remove, reorder, rename, and set durations for smart-practice blocks.
- Let users assign each block's duration in an intuitive way: fixed time or percentage of remaining session time.
- Let each block define its own purpose/instructions and tempo rule.
- Let each block choose whether it can drive progressions.
- Support advanced tempo rules for both songs and exercises.
- Add song count-up and non-metronome timed practice modes.
- Preserve statistics continuity when a song starts as no-BPM timed practice and later becomes Smart Practice.
- Keep new-item defaults configurable in Settings while allowing per-song and per-exercise overrides.

## Non-Goals

- No user-entered JavaScript or free-text formula language.
- No backend, accounts, cloud sync, or shared template marketplace.
- No changes to persistent recordings; recordings remain ephemeral.
- No automatic migration of old session records into richer per-block analytics beyond the existing session record shape.

## Recommended Approach

Use configurable block recipes everywhere in smart mode.

Existing built-in blocks become seeded default recipes rather than hard-coded session kinds. New songs and exercises copy the current defaults from Settings into their own item record. Editing an item changes only that item. Editing Settings changes future items only.

This avoids two competing systems for built-in vs custom blocks and prevents surprising global edits from changing old songs.

## Data Model

Add a generic smart block recipe shape:

```ts
type SmartBlockRecipe = {
  id: string;
  role:
    | "custom"
    | "slowReference"
    | "troubleSpot"
    | "ceilingWork"
    | "overspeed"
    | "consolidation"
    | "exerciseBuild"
    | "exerciseBurst"
    | "exerciseCoolDown";
  name: string;
  purpose: string;
  instructions: string[];
  enabled: boolean;
  duration: BlockDurationRule;
  tempoRule: TempoRule;
  metronomeEnabled: boolean;
  progression: ProgressionRule;
};
```

Add a structured duration rule:

```ts
type BlockDurationRule =
  | { kind: "fixed"; seconds: number }
  | { kind: "percent"; percent: number };
```

Fixed-time blocks are allocated first. Percent blocks divide the remaining session time after fixed blocks have been subtracted. For example, in a 10-minute session, a fixed 2-minute block leaves 8 minutes; percent blocks then divide those 8 minutes by their percentages. If fixed blocks exceed the selected session length, the editor and start-session flow should block the run with a clear validation error.

The editor must show this rule near the duration controls so users understand that percentages apply to the remaining time, not the original total when fixed blocks are present.

`role` preserves compatibility and special behavior where needed. For example, `troubleSpot` still expands into one block per trouble spot, while `custom` is a normal single block.

Add a structured tempo rule:

```ts
type TempoRule =
  | { source: "working"; adjustment?: TempoAdjustment }
  | { source: "target"; adjustment?: TempoAdjustment }
  | { source: "overspeed"; adjustment?: TempoAdjustment }
  | { source: "original"; adjustment?: TempoAdjustment; fallback: TempoRule }
  | { source: "trouble"; adjustment?: TempoAdjustment; fallback: TempoRule }
  | { source: "fixed"; bpm: number };

type TempoAdjustment =
  | { kind: "percent"; value: number }
  | { kind: "bpmOffset"; value: number }
  | { kind: "steps"; value: number };
```

Examples:

- Slow Reference: `working` with `percent: 80`.
- Consolidation: `working` with `percent: 70`.
- Ceiling Work: `working` with `steps: 1`.
- Overspeed: `working` with `steps: 2`, or `target` with `steps: 1`.
- Trouble Spot: `trouble`, fallback to `working` with `percent: 80`.
- Performance Pass: `original` with `bpmOffset: -10`, fallback to `working`.

Add a progression rule:

```ts
type ProgressionRule =
  | { kind: "none" }
  | { kind: "working" }
  | { kind: "trouble" };
```

`trouble` is valid only for blocks with `role: "troubleSpot"` because those blocks expand per spot and know which trouble index they represent.

## Song Modes

Replace the song practice-mode concept with a broader session shape:

```ts
type PracticeMode = "smart" | "simple" | "timed" | "openEnded";
```

- `smart`: recipe-based block sequence with optional warm-up.
- `simple`: one countdown block at working BPM with metronome on.
- `timed`: one countdown block, metronome optional, no progression required.
- `openEnded`: one count-up block, metronome optional, no planned duration.

Songs in `timed` or `openEnded` mode can have `workingBpm: null` when their metronome is off. Switching to `smart`, `simple`, or any metronome-on mode requires a valid working BPM.

Add song fields:

```ts
workingBpm: number | null;
defaultSessionMinutes: number;
metronomeEnabled: boolean;
blockTemplate: SmartBlockRecipe[];
```

Use the existing `practiceMode` field as the single mode source. Do not add a separate `openEnded` boolean for songs.

`defaultSessionMinutes` is the song's saved session length for timed runs. The song detail page should start sessions using this saved value. Users change it from the create/edit song form, not as a one-off start option.

## Exercise Modes

Exercises should use the same `PracticeMode` union and the same `SmartBlockRecipe[]` model. Existing exercise behavior maps as:

- `openEnded: true` -> `practiceMode: "openEnded"`.
- `practiceMode: "simple"` -> unchanged meaning.
- `practiceMode: "smart"` -> recipe-based Build/Burst/Cool Down defaults.

Exercises should keep requiring `workingBpm` in every mode. This keeps existing exercise tempo and promotion assumptions simple.

Exercises should keep their saved session length field as `sessionMinutes` for compatibility, but the UI should label it as the exercise's default session length. Users change it from the create/edit exercise form, and starting the exercise uses that saved value.

## Block Building

Replace the fixed `SONG_BLOCK_FACTORIES` and `EXERCISE_BLOCK_FACTORIES` path with a recipe interpreter:

1. Resolve the item mode.
2. For `openEnded`, return one unbounded block.
3. For `timed`, return one countdown block.
4. For `simple`, return one countdown metronome block.
5. For `smart`, filter enabled recipes with valid duration rules.
6. Allocate fixed-time recipes first.
7. Allocate percent recipes from the remaining session time.
8. Validate that fixed-time recipes do not exceed the selected session length and that enabled percent recipes have a positive total percent.
9. Expand `troubleSpot` recipes across all trouble spots.
10. Convert each recipe into a `BlockDef`.

`BlockDef` should gain `metronomeEnabled?: boolean` so a session can silence the click for individual blocks. For now, the UI can expose block-level metronome toggles in the editor but default all smart blocks to on.

Tempo calculation should move from fixed functions like `slowReferenceBpm` and `overspeedBpm` to `evaluateTempoRule(rule, item, context)`.

## Session Behavior

The song and exercise session pages should continue using the existing driver state machine.

Session start should skip creating a `Metronome` when the current item or current block has metronome off. During block transitions, the session should pause or resume the metronome based on the next block's `metronomeEnabled` flag.

The Earned button appears when a block's `progression.kind` is not `none`.

Promotions continue to write `PromotionEvent[]` into `SessionRecord`. Timed and open-ended sessions write records with zero promotions and nullable start/end BPM where needed.

## Stats Continuity

Stats remain keyed by `SessionRecord.itemId`, so all sessions for a song accumulate together regardless of mode.

A song can start with no working BPM in `timed` or `openEnded` no-metronome mode. Those sessions record:

- `durationSec`
- `plannedMinutes` for timed sessions
- `promotions: []`
- no start/end working BPM

When the same song later switches to Smart Practice, future sessions record starting BPM, ending BPM, trouble BPMs, and promotions under the same song ID.

## Forms and Settings

Settings:

- Default practice mode for new songs/exercises.
- Default song session length for new songs.
- Default exercise session length for new exercises.
- Default song smart block recipes.
- Default exercise smart block recipes.
- Block recipe editor for adding/removing/reordering/renaming blocks.

Song form:

- Allows `workingBpm` blank only when the selected mode and metronome setting do not require BPM.
- Supports Smart, Simple Metronome, Timed Practice, and Open Ended.
- Lets the user choose the saved session length for the song when creating or editing it.
- Shows block recipe editor only for Smart.
- Lets per-song edits override copied defaults.

Exercise form:

- Uses the same recipe editor for Smart.
- Lets the user choose the saved session length for the exercise when creating or editing it.
- Keeps existing Open Ended and metronome-off behavior but aligns labels with the new mode model.

Block editor:

- Name
- Purpose
- Instructions
- Enabled
- Duration rule: fixed time or percent of remaining session time
- Tempo rule
- Metronome enabled
- Progression behavior
- Live duration and BPM preview

The preview should show the exact computed duration for each block at the currently selected/default session length. If fixed-time blocks are present, the preview should explicitly state the remaining time that percent blocks are dividing.

## Migration

Add the next Dexie schema version and equivalent JSON-file lazy normalization.

Migration should:

- Convert existing `SongBlockTemplateEntry[]` to `SmartBlockRecipe[]`.
- Convert existing `ExerciseBlockTemplateEntry[]` to `SmartBlockRecipe[]`.
- Preserve enabled flags, duration proportions, order, and legacy roles.
- Convert legacy weights into percent duration rules that reproduce the existing proportional behavior.
- Seed tempo rules to match current behavior.
- Seed instructions from the existing `INSTRUCTIONS` map.
- Preserve `practiceMode`, `includeWarmupBlock`, total practice time, sort order, and session history.
- Convert exercise `openEnded: true` into `practiceMode: "openEnded"` and then remove dependency on the boolean in runtime logic.

No existing session records need to be rewritten.

## Testing

Unit tests:

- Tempo rule evaluation for all sources, adjustments, and fallbacks.
- Duration allocation for all-fixed, all-percent, and mixed fixed-plus-percent templates.
- Validation when fixed blocks exceed the selected session length.
- Song block building for smart, simple, timed, and open-ended modes.
- Exercise block building with migrated recipes.
- Trouble-spot recipe expansion and per-spot progression.
- Allocation totals still equal the selected session length.
- Songs with no working BPM are valid only for no-metronome timed/open-ended modes.
- Migration from current templates to recipe templates.
- Stats aggregation still sums sessions by item ID across mixed modes.

Manual verification:

- Create a no-BPM song and run timed practice without metronome.
- Edit the same song into Smart Practice by adding a working BPM.
- Confirm old and new session records appear under the same song.
- Create a custom block with a fixed BPM and no progression.
- Create a custom block that promotes working BPM.
- Mix fixed-time and percentage blocks and confirm the UI explains percent-of-remaining behavior.
- Change a song's saved session length in edit mode and confirm future starts use that saved length.
- Change Settings' default song/exercise session lengths and confirm newly created items inherit those values.
- Change Settings defaults and verify only newly created items use the new recipes.

## Risks and Mitigations

- Risk: too much UI complexity in one editor.
  Mitigation: start with compact rows and an edit modal/drawer for advanced rule details.

- Risk: mixed fixed and percent durations are misunderstood.
  Mitigation: show an inline explanation, computed remaining time, and per-block computed durations in the editor preview.

- Risk: free-form formulas become hard to validate.
  Mitigation: use structured rule fields only.

- Risk: old data loses behavior after migration.
  Mitigation: role-preserving migration with tests comparing old and new block totals and tempos.

- Risk: per-block metronome off complicates session playback.
  Mitigation: add metronome state handling around block transitions without changing the pure driver.

## Recorded Decisions

- User-facing mode labels should be `Smart Practice`, `Simple Metronome`, `Timed Practice`, and `Open Ended`.
- Block instructions should initially be edited in one multiline textarea, split into instruction lines on save. Separate bullet-row editing can be added later if the textarea feels too crude in use.
