# Block Editor Recipe Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `BlockTemplateEditor` as clearer recipe cards while preserving all existing block template behavior.

**Architecture:** This is a presentational refactor inside `src/components/session/BlockTemplateEditor.tsx`. Existing validation and allocation helpers remain the source of truth; the UI adds summary/chip helpers and reorganizes card layout around those values.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Vitest.

---

### Task 1: Add Display Helpers

**Files:**
- Modify: `src/components/session/BlockTemplateEditor.tsx`

- [ ] **Step 1: Add helpers for duration chip labels and summary state**

Add pure helpers near `fmtSecs`:

```ts
const durationChip = (
  entry: SmartBlockRecipe,
  variant: "song" | "exercise",
): string => {
  const additive = variant === "song" && entry.role === "troubleSpot";
  if (entry.duration.kind === "fixed") {
    return `${additive ? "+" : ""}${fmtSecs(entry.duration.seconds)}${additive ? " each" : " fixed"}`;
  }
  return `${entry.duration.percent}% remaining`;
};
```

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`
Expected: pass.

### Task 2: Replace Intro and Preview with Summary Panel

**Files:**
- Modify: `src/components/session/BlockTemplateEditor.tsx`

- [ ] **Step 1: Replace the existing explanation box with a summary panel**

Use existing `allocation`, `validation`, `allocationEntries`, and `additiveEntries` values. The panel must show fixed/percent explanation, base total status, and additive trouble time separately.

- [ ] **Step 2: Preserve existing validation messages**

The same messages from `validateTemplateForSession` must still appear when invalid.

### Task 3: Redesign Block Cards

**Files:**
- Modify: `src/components/session/BlockTemplateEditor.tsx`

- [ ] **Step 1: Add card header with checkbox, editable name/purpose, duration chip, and Up/Down buttons**

Keep existing `update`, `move`, and `remove` behavior.

- [ ] **Step 2: Keep controls grouped and wrapping**

Duration, Tempo, Progression, and Metronome controls must use explicit minimum widths and flex wrapping so fixed decimal inputs remain visible.

- [ ] **Step 3: Style additive trouble cards distinctly**

Song `troubleSpot` cards should use a subtle green border/background and a `+` duration chip.

### Task 4: Verify and Commit

**Files:**
- Test: `src/components/session/BlockTemplateEditor.tsx`

- [ ] **Step 1: Run checks**

Run:

```bash
npx tsc --noEmit
npm test -- --run src/lib/session/blocks.test.ts src/lib/session/exerciseBlocks.test.ts
npm run build
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Commit and push**

Stage only `BlockTemplateEditor.tsx` and this plan doc. Leave unrelated data JSON changes unstaged.
