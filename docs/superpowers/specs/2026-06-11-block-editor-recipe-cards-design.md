# Block Editor Recipe Cards Design

## Goal

Make smart practice block customization easier to understand without changing the underlying data model. The chosen direction is Option A: keep one editable card per block, but make each card read more like a clear practice recipe step instead of a dense settings form.

## User Problem

The current editor technically works, but it asks the user to parse too many controls at once. Duration, tempo, progression, metronome, purpose, and instructions compete visually. Fixed durations such as `1.5` minutes are especially sensitive to layout because adjacent controls can make the row feel cramped.

The improved UI should answer these questions at a glance:

- Is this block part of the base session or additive?
- How much time does it take?
- What tempo does it use?
- Does it promote working BPM, trouble BPM, or nothing?
- Is the whole base template valid for the selected session length?

## Selected Approach

Use simplified recipe cards in `BlockTemplateEditor`.

Each card keeps the current editable capabilities:

- enable or disable block
- reorder block
- edit name and purpose
- choose fixed or percentage duration
- choose tempo source and adjustment
- choose progression behavior
- toggle metronome
- edit instructions
- remove block

The presentation changes:

- Add a top summary panel above the cards.
- Show the base timed total, for example `Base total: 10:00 / 10:00`.
- Show additive trouble time separately, for example `Trouble: +2:00 per spot`.
- Give each block card a strong header with block name, purpose, and a duration chip.
- Label Trouble Spot as additive when it is a song trouble block.
- Group the main controls into three stable areas: Duration, Tempo, and Progression.
- Keep instructions inside the card but visually below the main controls.

## Layout Details

The top summary should appear before the block list. It should include validation status:

- Valid fixed-only template: show a calm success state such as `Base total: 10:00 / 10:00`.
- Fixed total under the selected duration with no percent blocks: show the existing validation message.
- Fixed total above the selected duration: show the existing validation message.
- Percent blocks present: show how much time remains after fixed blocks.
- Additive trouble blocks: show that this time is outside the base session.

Each block card should have this structure:

1. Left side: enable checkbox and optional drag/reorder affordance.
2. Main header: editable name and purpose, but presented compactly.
3. Right side: duration chip such as `1:30 fixed`, `50% remaining`, or `+2:00 each`.
4. Control row:
   - Duration group: mode selector and value field.
   - Tempo group: source selector, adjustment selector, and adjustment value when needed.
   - Progression group: progression selector.
   - Metronome toggle aligned with the control row but allowed to wrap.
5. Instructions textarea.
6. Remove block action.

Controls must use wrapping groups with explicit minimum widths. Decimal fixed-minute values such as `1.5` must remain visible and must not be obscured by tempo controls.

## Additive Trouble Spot Behavior

For song templates, any enabled `troubleSpot` recipe is additive and does not count toward the base session duration. The UI should make this visually distinct:

- duration chip uses a plus sign, for example `+2:00 each`
- summary calls it out separately from the base total
- preview copy says trouble time is added outside the base session

Exercise templates do not have additive trouble spot behavior.

## Data Model

No schema or type changes are needed. The redesign uses existing fields on `SmartBlockRecipe`:

- `name`
- `purpose`
- `enabled`
- `duration`
- `tempoRule`
- `metronomeEnabled`
- `progression`
- `instructions`

All validation should continue using `validateTemplateForSession`, `validateBlockDurationPlan`, and `allocateBlockDurations`.

## Out Of Scope

This design does not add:

- drag-and-drop reordering
- a timeline allocator
- a focused side drawer
- a spreadsheet table editor
- new block duration semantics
- new tempo rule semantics
- schema migrations

## Testing

Because this is primarily a UI refactor, verification should include:

- TypeScript check.
- Existing duration/session tests.
- Production build.
- Manual browser check of `/songs/new`, `/settings`, and at least one existing song edit page.
- Narrow viewport check that Duration, Tempo, Progression, and Metronome controls wrap without overlap.

## Open Decisions

Use button-based Up/Down reordering for now, matching the current app. Drag handles can be visual only unless drag-and-drop is explicitly requested later.
