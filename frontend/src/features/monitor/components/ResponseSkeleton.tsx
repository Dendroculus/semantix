export function ResponseSkeleton(): JSX.Element {
  return (
    <output
      aria-label="Loading query response"
      aria-live="polite"
      className="block animate-pulse border-y border-l-2 border-(--hairline) border-l-(--gold) bg-(--surface) px-4 py-5 sm:px-6"
    >
      <span className="sr-only">
        Embedding the prompt and checking the semantic cache.
      </span>
      <span className="flex items-center justify-between gap-6 border-b border-(--hairline) pb-4">
        <span className="h-5 w-36 bg-[rgba(234,230,221,0.08)]" />
        <span className="h-3 w-20 bg-[rgba(212,161,90,0.18)]" />
      </span>
      <span className="mt-5 block h-3 w-full bg-[rgba(234,230,221,0.06)]" />
      <span className="mt-3 block h-3 w-11/12 bg-[rgba(234,230,221,0.06)]" />
      <span className="mt-3 block h-3 w-3/5 bg-[rgba(234,230,221,0.06)]" />
      <span className="mt-7 grid grid-cols-2 gap-px border-t border-(--hairline) bg-(--hairline) pt-px min-[760px]:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <span className="h-14 bg-(--surface) p-3" key={item}>
            <span className="block h-2 w-16 bg-[rgba(234,230,221,0.05)]" />
            <span className="mt-2 block h-3 w-10 bg-[rgba(91,156,148,0.12)]" />
          </span>
        ))}
      </span>
    </output>
  );
}
