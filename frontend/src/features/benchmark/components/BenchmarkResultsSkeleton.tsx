export function BenchmarkResultsSkeleton(): JSX.Element {
  return (
    <output
      aria-label="Loading benchmark results"
      aria-live="polite"
      className="mt-8 block animate-pulse"
    >
      <span className="ui-label text-(--gold)">
        Running controlled query sequence
      </span>
      <span className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
          <span
            className="border-t border-(--hairline) pt-3"
            key={item}
          >
            <span className="block h-2 w-20 bg-[rgba(234,230,221,0.05)]" />
            <span className="mt-3 block h-5 w-16 bg-[rgba(234,230,221,0.08)]" />
          </span>
        ))}
      </span>
      <span className="mt-10 grid gap-8 md:grid-cols-2">
        {[0, 1].map((item) => (
          <span
            className="border-t border-(--hairline) pt-4"
            key={item}
          >
            <span className="block h-2 w-44 bg-[rgba(234,230,221,0.05)]" />
            <span className="mt-4 block h-36 bg-[rgba(91,156,148,0.06)]" />
          </span>
        ))}
      </span>
    </output>
  );
}
