import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BlockTemplateEditor,
  validateTemplateForSession,
} from "./BlockTemplateEditor";
import type { SmartBlockRecipe } from "@/types/song";

const recipe = (
  overrides: Partial<SmartBlockRecipe> = {},
): SmartBlockRecipe => ({
  id: "block",
  role: "ceilingWork",
  name: "Block",
  purpose: "test",
  instructions: ["test"],
  enabled: true,
  duration: { kind: "fixed", seconds: 300 },
  tempoRule: { source: "working" },
  metronomeEnabled: true,
  progression: { kind: "none" },
  ...overrides,
});

describe("validateTemplateForSession", () => {
  it("rejects trouble tempo rules for exercise templates", () => {
    expect(
      validateTemplateForSession(
        [
          recipe({
            role: "exerciseBuild",
            tempoRule: { source: "trouble", fallback: { source: "working" } },
          }),
        ],
        5,
        "exercise",
      ),
    ).toEqual({
      ok: false,
      message: "Trouble tempo is only available on song Trouble Spot blocks.",
    });
  });

  it("rejects trouble progression outside song trouble-spot rows", () => {
    expect(
      validateTemplateForSession(
        [recipe({ progression: { kind: "trouble" } })],
        5,
        "song",
      ),
    ).toEqual({
      ok: false,
      message: "Trouble progression is only available on song Trouble Spot blocks.",
    });
  });

  it("rejects trouble progression for exercise templates", () => {
    expect(
      validateTemplateForSession(
        [
          recipe({
            role: "exerciseBuild",
            progression: { kind: "trouble" },
          }),
        ],
        5,
        "exercise",
      ),
    ).toEqual({
      ok: false,
      message: "Trouble progression is only available on song Trouble Spot blocks.",
    });
  });

  it("allows trouble progression on song trouble-spot rows", () => {
    expect(
      validateTemplateForSession(
        [
          recipe({ id: "base" }),
          recipe({
            id: "trouble",
            role: "troubleSpot",
            progression: { kind: "trouble" },
          }),
        ],
        5,
        "song",
        1,
      ),
    ).toEqual({ ok: true });
  });
});

describe("BlockTemplateEditor", () => {
  it("renders block rows collapsed by default with summary details visible", () => {
    const template = [
      recipe({
        name: "Ceiling Work",
        purpose: "Push the tune speed.",
        instructions: ["Play cleanly", "Relax the right hand"],
        duration: { kind: "fixed", seconds: 300 },
        tempoRule: { source: "target" },
        metronomeEnabled: true,
        progression: { kind: "working" },
      }),
    ];

    const html = renderToStaticMarkup(
      createElement(BlockTemplateEditor, {
        template,
        onChange: () => undefined,
        previewMinutes: 5,
        variant: "song",
      }),
    );

    expect(html).toContain("Base total:");
    expect(html).toContain("Ceiling Work");
    expect(html).toContain("5m fixed");
    expect(html).toContain("Target");
    expect(html).toContain("Promote working");
    expect(html).toContain("Metronome on");
    expect(html).toContain("Edit");
    expect(html).not.toContain("Duration");
    expect(html).not.toContain("Instructions");
    expect(html).not.toContain("Play cleanly");
  });

  it("renders the Trouble tempo source only for song templates", () => {
    const source = readFileSync(
      new URL("./BlockTemplateEditor.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('variant === "song"');
    expect(source).toContain('<option value="trouble">Trouble</option>');
  });
});
