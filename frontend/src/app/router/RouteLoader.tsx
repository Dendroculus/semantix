export function RouteLoader(): JSX.Element {
  return (
    <section
      aria-live="polite"
      className="flex min-h-64 items-center justify-center border-y border-[var(--hairline)]"
      role="status"
    >
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin border border-[var(--hairline)] border-t-[var(--gold)]"
        />
        <p className="ui-label mt-4 text-[var(--text-muted)]">
          Loading workspace
        </p>
      </div>
    </section>
  );
}
