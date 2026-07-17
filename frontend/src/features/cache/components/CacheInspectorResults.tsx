import { CacheEntryCard } from "./CacheEntryCard";
import type { CacheInspectorController } from "../hooks/useCacheInspector";

interface CacheInspectorResultsProps {
  inspector: CacheInspectorController;
}

export function CacheInspectorResults({
  inspector,
}: CacheInspectorResultsProps): JSX.Element {
  const {
    actionError,
    cancelDelete,
    confirmDeleteEntry,
    data,
    hasNext,
    hasPrevious,
    isLoading,
    loadError,
    mutation,
    nextPage,
    pendingDelete,
    previousPage,
    refresh,
    requestDelete,
    search,
    visibleEnd,
    visibleStart,
  } = inspector;

  return (
    <>
      {actionError !== null && (
        <p
          className="font-data mt-5 text-[11px] text-[var(--coral)]"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {loadError !== null && (
        <div
          className="mt-6 border-l border-[var(--coral)] pl-4"
          role="alert"
        >
          <p className="text-sm text-[var(--text-soft)]">
            {loadError}
          </p>
          <button
            className="ui-label mt-3 text-[var(--teal)]"
            type="button"
            onClick={refresh}
          >
            Try again
          </button>
        </div>
      )}

      {data !== null &&
        loadError === null &&
        data.items.length === 0 && (
          <div className="mt-7 border-y border-[var(--hairline)] py-8">
            <p className="font-display text-xl italic text-[var(--text-soft)]">
              {search.trim() === ""
                ? "The cache is empty."
                : "No cached prompts match this search."}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {search.trim() === ""
                ? "Run a query to create the first inspectable entry."
                : "Try a broader prompt fragment or clear the search field."}
            </p>
          </div>
        )}

      {data !== null &&
        loadError === null &&
        data.items.length > 0 && (
          <ol className="mt-6">
            {data.items.map((entry) => (
              <CacheEntryCard
                key={entry.cache_key}
                entry={entry}
                isDeleting={mutation === entry.cache_key}
                isPendingDelete={
                  pendingDelete === entry.cache_key
                }
                onCancelDelete={cancelDelete}
                onConfirmDelete={() =>
                  void confirmDeleteEntry(entry.cache_key)
                }
                onRequestDelete={() =>
                  requestDelete(entry.cache_key)
                }
              />
            ))}
          </ol>
        )}

      {data !== null && loadError === null && (
        <footer className="font-data mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hairline)] pt-4 text-[10px] text-[var(--text-faint)]">
          <span>
            {visibleStart}-{visibleEnd} of {data.total} entries
          </span>
          <div className="flex gap-5">
            <button
              className="ui-label text-[var(--teal)] disabled:text-[var(--text-faint)]"
              disabled={!hasPrevious || isLoading}
              type="button"
              onClick={previousPage}
            >
              Previous
            </button>
            <button
              className="ui-label text-[var(--teal)] disabled:text-[var(--text-faint)]"
              disabled={!hasNext || isLoading}
              type="button"
              onClick={nextPage}
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </>
  );
}
