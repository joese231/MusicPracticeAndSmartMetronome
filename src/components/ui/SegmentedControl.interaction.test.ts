// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "smart", label: "Smart" },
  { value: "simple", label: "Simple" },
  { value: "timed", label: "Timed" },
] as const;

function Harness() {
  const [value, setValue] = useState<(typeof options)[number]["value"]>("smart");
  return React.createElement(SegmentedControl, {
    value,
    options,
    onChange: (next: string) =>
      setValue(next as (typeof options)[number]["value"]),
    ariaLabel: "Practice mode",
  });
}

afterEach(() => cleanup());

describe("SegmentedControl interaction", () => {
  it("supports click and arrow-key selection in jsdom", async () => {
    const user = userEvent.setup();
    render(React.createElement(Harness));

    await user.click(screen.getByRole("radio", { name: "Timed" }));
    expect(screen.getByRole("radio", { name: "Timed" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Practice mode" }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("radio", { name: "Smart" }).getAttribute("aria-checked")).toBe("true");
  });
});
