"use client";

import React from "react";
import type { KeyboardEvent } from "react";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

export function nextSegmentedValue<T extends string>(
  options: readonly SegmentedControlOption<T>[],
  value: string,
  delta: 1 | -1,
): T | undefined {
  if (options.length === 0) return undefined;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const nextIndex = (activeIndex + delta + options.length) % options.length;
  return options[nextIndex]?.value;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: T;
  options: readonly SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const activeIndex = options.findIndex((option) => option.value === value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = nextSegmentedValue(
      options,
      value,
      event.key === "ArrowRight" ? 1 : -1,
    );
    if (next !== undefined) onChange(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex flex-wrap overflow-hidden rounded-lg border border-bg-border bg-bg sm:inline-flex ${className}`}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (activeIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-accent text-black"
                : "text-neutral-300 hover:bg-bg-elevated"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
