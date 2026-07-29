import type { JSX } from "react";

const WORKSPACE_COLUMNS = [0, 1, 2] as const;

export function RouteLoader(): JSX.Element {
  return (
    <output
      aria-label="Loading workspace"
      aria-live="polite"
      className="block min-h-64 animate-pulse border-y border-(--hairline) py-8"
    >
      <span className="ui-label block text-(--text-muted)">
        Loading workspace
      </span>
      <span
        aria-hidden="true"
        className="mt-6 block"
      >
        <span className="block h-8 w-64 max-w-3/5 bg-[rgba(234,230,221,0.08)]" />
        <span className="mt-4 block h-3 w-full max-w-2xl bg-[rgba(234,230,221,0.05)]" />
        <span className="mt-2 block h-3 w-4/5 max-w-xl bg-[rgba(234,230,221,0.05)]" />
        <span
          className="mt-8 grid gap-px border border-(--hairline) bg-(--hairline) md:grid-cols-3"
        >
          {WORKSPACE_COLUMNS.map((column) => (
            <span
              className="block min-h-28 bg-(--surface) p-5"
              key={column}
            >
              <span className="block h-2.5 w-20 bg-[rgba(91,156,148,0.12)]" />
              <span className="mt-5 block h-6 w-28 bg-[rgba(234,230,221,0.08)]" />
              <span className="mt-4 block h-2.5 w-full bg-[rgba(234,230,221,0.05)]" />
            </span>
          ))}
        </span>
      </span>
    </output>
  );
}
