import type { CacheEntrySort } from '../types';
import {
  CACHE_NAMESPACE_PATTERN_SOURCE,
  MAX_CACHE_NAMESPACE_LENGTH,
} from '../namespace';

interface CacheInspectorControlsProps {
  canClear: boolean;
  confirmClear: boolean;
  isClearing: boolean;
  isLoading: boolean;
  isMutating: boolean;
  namespace: string;
  onCancelClear: () => void;
  onConfirmClear: () => void;
  onRefresh: () => void;
  onRequestClear: () => void;
  onNamespaceChange: (namespace: string) => void;
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
  namespace,
  onCancelClear,
  onConfirmClear,
  onRefresh,
  onRequestClear,
  onNamespaceChange,
  onSearchChange,
  onSortChange,
  search,
  sort,
}: Readonly<CacheInspectorControlsProps>): JSX.Element {
  const selectedNamespace = namespace.trim();
  const isNamespaceSelected = selectedNamespace !== '';
  const controlClass =
    'font-data mt-2 min-h-10 w-full border border-(--hairline) bg-(--surface) px-3 py-2.5 text-xs text-(--text) outline-none transition-colors hover:border-(--text-faint) focus-visible:border-(--teal) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--teal)';

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

        <div className="flex flex-wrap gap-3">
          <button
            className="ui-label min-h-10 border border-(--hairline) px-3 py-2 text-(--teal) transition-colors hover:border-(--teal) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--teal) active:translate-y-px disabled:opacity-50"
            disabled={isLoading || isMutating}
            type="button"
            onClick={onRefresh}
          >
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
          <button
            className="ui-label min-h-10 border border-(--hairline) px-3 py-2 text-(--coral) transition-colors hover:border-(--coral) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--coral) active:translate-y-px disabled:opacity-50"
            disabled={isMutating || !canClear}
            type="button"
            onClick={onRequestClear}
          >
            {isNamespaceSelected ? 'Clear namespace' : 'Clear all entries'}
          </button>
        </div>
      </header>

      {confirmClear && (
        <fieldset
          aria-label="Confirm clear cache"
          className="mt-5 min-w-0 border-0 border-l border-(--coral) p-0 pl-4"
        >
          <p className="text-sm text-(--text-soft)">
            {isNamespaceSelected
              ? `Clear every entry and reset statistics for ${selectedNamespace}?`
              : 'Clear every cache entry and reset all backend cache statistics?'}
          </p>
          <div className="mt-3 flex gap-5">
            <button
              className="ui-label min-h-9 text-(--coral) underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--coral) active:translate-y-px disabled:opacity-50"
              disabled={isClearing}
              type="button"
              onClick={onConfirmClear}
            >
              {isClearing ? 'Clearing' : 'Confirm clear cache'}
            </button>
            <button
              className="ui-label min-h-9 text-(--teal) underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--teal) active:translate-y-px disabled:opacity-50"
              disabled={isClearing}
              type="button"
              onClick={onCancelClear}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      )}

      <div className="mt-7 grid gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_220px]">
        <div>
          <label
            className="ui-label text-(--text-muted)"
            htmlFor="cache-search"
          >
            Search cached prompts
          </label>
          <input
            className={controlClass}
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
            htmlFor="cache-namespace"
          >
            Namespace
          </label>
          <input
            className={controlClass}
            id="cache-namespace"
            maxLength={MAX_CACHE_NAMESPACE_LENGTH}
            pattern={CACHE_NAMESPACE_PATTERN_SOURCE}
            placeholder="All namespaces"
            type="text"
            value={namespace}
            onChange={(event) => onNamespaceChange(event.target.value)}
          />
        </div>

        <div>
          <label className="ui-label text-(--text-muted)" htmlFor="cache-sort">
            Sort cache entries
          </label>
          <select
            className={controlClass}
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
