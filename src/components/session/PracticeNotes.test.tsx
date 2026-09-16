// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PracticeNotes } from "./PracticeNotes";

afterEach(cleanup);

describe("PracticeNotes", () => {
  it("displays existing notes and saves edited text", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<PracticeNotes notes="Relax your hand" onSave={save} />);
    expect(screen.getByText("Relax your hand")).toBeTruthy();
    fireEvent.click(screen.getByText("Edit notes"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Slow down\nBar 3  " } });
    fireEvent.click(screen.getByText("Save notes"));
    await waitFor(() => expect(save).toHaveBeenCalledWith("Slow down\nBar 3"));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("keeps failed edits available for retry", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    render(<PracticeNotes notes={null} onSave={save} />);
    fireEvent.click(screen.getByText("Add notes"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByText("Save notes"));
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this draft");
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("clears notes by saving empty text", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<PracticeNotes notes="Old note" onSave={save} />);
    fireEvent.click(screen.getByText("Edit notes"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Save notes"));
    await waitFor(() => expect(save).toHaveBeenCalledWith(null));
  });
});
