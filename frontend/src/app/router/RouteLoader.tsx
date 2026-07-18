export function RouteLoader(): JSX.Element {
  return (
    <section
      aria-live="polite"
      className="flex min-h-64 items-center justify-center border-y border-(--hairline)"
      role="status"
    >
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin border border-(--hairline) border-t-(--gold)"
        />
        <p className="ui-label mt-4 text-(--text-muted)">
          Loading workspace
        </p>
      </div>
    </section>
  );
}
