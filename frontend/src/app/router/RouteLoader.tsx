export function RouteLoader(): JSX.Element {
  return (
    <output
      aria-live="polite"
      className="flex min-h-64 items-center justify-center border-y border-(--hairline)"
    >
      <span className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin border border-(--hairline) border-t-(--gold)"
        />
        <span className="ui-label mt-4 block text-(--text-muted)">
          Loading workspace
        </span>
      </span>
    </output>
  );
}
