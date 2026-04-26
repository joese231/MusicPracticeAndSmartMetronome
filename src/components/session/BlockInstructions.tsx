"use client";
export function BlockInstructions({ items }: { items: string[] }) {
  return (
    <ul className="mx-auto max-w-2xl space-y-2 rounded-lg border border-bg-border bg-bg-elevated/60 px-6 py-5 text-left text-lg text-neutral-200 md:text-xl">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
