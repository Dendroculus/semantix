import type { CacheEntrySort } from "../types";

interface CacheInspectorControlsProps {
  canClear: boolean;
  confirmClear: boolean;
  isClearing: boolean;
  isLoading: boolean;
  isMutating: boolean;
  onCancelClear: () => void;
  onConfirmClear: () => void;
  onRefresh: () => void;
  onRequestClear: () => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: CacheEntrySort) => void;
  search: string;
  sort: CacheEntrySort;
}

export function CacheInspectorControls({
  canClear,
  confirmClear,
  isClearing,
  isLoading,
  isMutating,
  onCancelClear,
  onConfirmClear,
  onRefresh,
  onRequestClear,
  onSearchChange,
  onSortChange,
  search,
  sort,
}: CacheInspectorControlsProps): JSX.Element {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2
            className="font-display text-2xl italic"
            id="cache-inspector-heading"
          >
            Cache entries
          </h2>
          <p className="ui-label mt-1 text-(--text-faint)">
            Live entry metadata / embeddings excluded
          </p>
        </div>

        <div className="flex flex-wrap gap-5">
          <button
            className="ui-label border-b border-(--teal) pb-1 text-(--teal) disabled:opacity-50"
            disabled={isLoading || isMutating}
            type="button"
            onClick={onRefresh}
          >
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
          <button
            className="ui-label border-b border-(--coral) pb-1 text-(--coral) disabled:opacity-50"
            disabled={isMutating || !canClear}
            type="button"
            onClick={onRequestClear}
          >
            Clear all entries
          </button>
        </div>
      </header>

      {confirmClear && (
        <div
          aria-label="Confirm clear cache"
          className="mt-5 border-l border-(--coral) pl-4"
          role="group"
        >
          <p className="text-sm text-(--text-soft)">
            Clear every cache entry and reset backend cache statistics?
          </p>
          <div className="mt-3 flex gap-5">
            <button
              className="ui-label text-(--coral) disabled:opacity-50"
              disabled={isClearing}
              type="button"
              onClick={onConfirmClear}
            >
              {isClearing ? "Clearing" : "Confirm clear cache"}
            </button>
            <button
              className="ui-label text-(--teal) disabled:opacity-50"
              disabled={isClearing}
              type="button"
              onClick={onCancelClear}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-5 min-[680px]:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label
            className="ui-label text-(--text-muted)"
            htmlFor="cache-search"
          >
            Search cached prompts
          </label>
          <input
            className="font-data mt-2 w-full border border-(--hairline) bg-(--surface) px-3 py-2.5 text-xs text-(--text) outline-none focus:border-(--teal)"
            id="cache-search"
            placeholder="Filter by original prompt"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div>
          <label
            className="ui-label text-(--text-muted)"
            htmlFor="cache-sort"
          >
            Sort cache entries
          </label>
          <select
            className="font-data mt-2 w-full border border-(--hairline) bg-(--surface) px-3 py-2.5 text-xs text-(--text) outline-none focus:border-(--teal)"
            id="cache-sort"
            value={sort}
            onChange={(event) =>
              onSortChange(event.target.value as CacheEntrySort)
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most_hit">Most hit</option>
            <option value="nearest_expiry">Nearest expiry</option>
          </select>
        </div>
      </div>
    </>
  );
}
