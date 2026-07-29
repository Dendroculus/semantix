import type { JSX } from "react";

export function BenchmarkDatasetSkeleton(): JSX.Element {
  return (
    <output
      aria-label="Loading benchmark datasets"
      aria-live="polite"
      className="block animate-pulse border-y border-(--hairline) py-6"
    >
      <span className="sr-only">Loading the benchmark dataset catalog.</span>
      <span
        aria-hidden="true"
        className="grid gap-5 md:grid-cols-3"
      >
        {[0, 1, 2].map((item) => (
          <span className="block" key={item}>
            <span className="block h-2 w-24 bg-[rgba(234,230,221,0.06)]" />
            <span className="mt-3 block h-10 border border-(--hairline) bg-(--surface)" />
          </span>
        ))}
      </span>
    </output>
  );
}
