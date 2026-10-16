// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/song";
import { ExerciseForm } from "./ExerciseForm";

// Existing components rely on Next's automatic JSX runtime; Vitest uses classic JSX.
vi.stubGlobal("React", React);

vi.mock("@/lib/store/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) => selector({ loaded: true, settings: DEFAULT_SETTINGS, load: vi.fn() }),
}));
afterEach(cleanup);

describe("ExerciseForm optional BPM", () => {
  it("saves a countdown without BPM and preserves the saved metronome preference", async () => {
    const submit = vi.fn();
    render(<ExerciseForm initial={{ name: "Silent countdown", practiceMode: "simple", metronomeEnabled: false }} submitLabel="Save exercise" onSubmit={submit} />);
    expect(screen.queryByRole("radio", { name: "Timed" })).toBeNull();
    expect(screen.queryByText("Disable metronome for this exercise")).toBeNull();
    const bpm = screen.getByRole("spinbutton", { name: /Starting working BPM/ }) as HTMLInputElement;
    expect(bpm.required).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ workingBpm: null, practiceMode: "simple", metronomeEnabled: false })));
  });

  it("edits legacy timed exercises as Simple", async () => {
    const submit = vi.fn();
    render(<ExerciseForm initial={{ name: "Legacy timer", practiceMode: "timed", workingBpm: 80 }} submitLabel="Save exercise" onSubmit={submit} />);
    expect(screen.getByRole("radio", { name: "Simple" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ practiceMode: "simple", workingBpm: 80 })));
  });

  it("requires BPM for Smart and permits an empty BPM for Open Ended", () => {
    render(<ExerciseForm initial={{ name: "Mode switch", practiceMode: "smart" }} submitLabel="Save exercise" onSubmit={vi.fn()} />);
    const bpm = screen.getByRole("spinbutton", { name: /Starting working BPM/ }) as HTMLInputElement;
    expect(bpm.required).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Open Ended" }));
    expect(bpm.required).toBe(false);
  });
});
