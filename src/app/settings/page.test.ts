import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SettingsPage accessibility", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  it("passes accessible names into every settings toggle", () => {
    expect(source).toContain('ariaLabel="Record practice sessions"');
    expect(source).toContain('ariaLabel="Use accented clicks"');
    expect(source).toContain('ariaLabel="Auto-advance between blocks"');
  });

  it("applies the toggle accessible name to the button", () => {
    expect(source).toContain("aria-label={ariaLabel}");
  });

  it("edits default block templates as local drafts with explicit save", () => {
    expect(source).toContain("songTemplateDraft");
    expect(source).toContain("exerciseTemplateDraft");
    expect(source).toContain("Save song default sequence");
    expect(source).toContain("Save exercise default sequence");
    expect(source).toContain("songTemplateValidation.ok");
    expect(source).toContain("exerciseTemplateValidation.ok");
  });
});
