import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Components } from "react-markdown";
import "katex/dist/katex.min.css";

import { unwrapOuterMarkdownFence } from "../lib/markdown";
import {
  clearCache,
  deleteCacheEntry,
  listCacheEntries,
} from "../services/apiClient";
import type {
  CacheEntryListResponse,
  CacheEntryMetadata,
  CacheEntrySort,
} from "../types/api";

const PAGE_SIZE = 10;
const CODE_SEGMENT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
const DISPLAY_MATH = /\\\[([\s\S]*?)\\\]/g;
const INLINE_MATH = /\\\(([\s\S]*?)\\\)/g;

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export type CacheMutation = "delete" | "clear";

interface CacheInspectorProps {
  refreshKey: number;
  onMutation: (mutation: CacheMutation) => void;
}

interface EntryCardProps {
  entry: CacheEntryMetadata;
  isDeleting: boolean;
  isPendingDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRequestDelete: () => void;
}

function replaceDisplayMath(_match: string, expression: string): string {
  return `\n\n$$\n${expression.trim()}\n$$\n\n`;
}

function replaceInlineMath(_match: string, expression: string): string {
  return `$${expression.trim()}$`;
}

function normalizeMathDelimiters(markdown: string): string {
  return markdown
    .split(CODE_SEGMENT)
    .map((segment) => {
      if (
        segment.startsWith("```") ||
        segment.startsWith("~~~") ||
        segment.startsWith("`")
      ) {
        return segment;
      }

      return segment
        .replace(DISPLAY_MATH, replaceDisplayMath)
        .replace(INLINE_MATH, replaceInlineMath);
    })
    .join("");
}

const previewMarkdownComponents: Components = {
  p: ({ ...props }) => (
    <p
      className="mb-2 whitespace-pre-wrap break-words leading-6 last:mb-0"
      {...props}
    />
  ),

  strong: ({ ...props }) => (
    <strong
      className="font-semibold text-[var(--text)]"
      {...props}
    />
  ),

  em: ({ ...props }) => <em {...props} />,

  a: ({ children, ...props }) => (
    <a
      className="text-[var(--teal)] underline decoration-[rgba(91,156,148,0.35)] underline-offset-4 hover:text-[var(--text)]"
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),

  ul: ({ ...props }) => (
    <ul
      className="mb-2 list-disc space-y-1 pl-5 last:mb-0"
      {...props}
    />
  ),

  ol: ({ ...props }) => (
    <ol
      className="mb-2 list-decimal space-y-1 pl-5 last:mb-0"
      {...props}
    />
  ),

  li: ({ ...props }) => <li className="leading-6" {...props} />,

  blockquote: ({ ...props }) => (
    <blockquote
      className="mb-2 border-l-2 border-[var(--hairline)] pl-3 italic text-[var(--text-muted)] last:mb-0"
      {...props}
    />
  ),

  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");

    return isBlock ? (
      <code
        className={`font-data block whitespace-pre-wrap break-words ${
          className ?? ""
        }`}
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className="font-data rounded bg-[rgba(234,230,221,0.08)] px-1.5 py-0.5 text-[0.85em] text-[var(--gold)]"
        {...props}
      >
        {children}
      </code>
    );
  },

  pre: ({ ...props }) => (
    <pre
      className="scrollbar-thin mb-2 overflow-x-auto rounded border border-[var(--hairline)] bg-[rgba(0,0,0,0.25)] p-3 text-xs last:mb-0"
      {...props}
    />
  ),

  h1: ({ children, ...props }) => (
    <h4
      className="font-display mb-2 text-base italic text-[var(--text)]"
      {...props}
    >
      {children}
    </h4>
  ),

  h2: ({ children, ...props }) => (
    <h4
      className="font-display mb-2 text-base italic text-[var(--text)]"
      {...props}
    >
      {children}
    </h4>
  ),

  h3: ({ children, ...props }) => (
    <h4
      className="font-display mb-2 text-sm italic text-[var(--text)]"
      {...props}
    >
      {children}
    </h4>
  ),

  table: ({ ...props }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table
        className="font-data w-full border-collapse text-xs"
        {...props}
      />
    </div>
  ),

  th: ({ ...props }) => (
    <th
      className="border-b border-[var(--hairline)] px-2 py-1.5 text-left text-[var(--text-faint)]"
      {...props}
    />
  ),

  td: ({ ...props }) => (
    <td
      className="border-b border-[rgba(234,230,221,0.05)] px-2 py-1.5"
      {...props}
    />
  ),

  hr: ({ ...props }) => (
    <hr
      className="my-3 border-0 border-t border-[var(--hairline)]"
      {...props}
    />
  ),
};

function formatTimestamp(value: string | null): string {
  return value === null ? "Never" : DATE_FORMATTER.format(new Date(value));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "No expiry";
  }

  if (seconds < 1) {
    return "<1 s";
  }

  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function shortCacheKey(cacheKey: string): string {
  return `${cacheKey.slice(0, 10)}...${cacheKey.slice(-6)}`;
}

function EntryCard({
  entry,
  isDeleting,
  isPendingDelete,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
}: EntryCardProps): JSX.Element {
  const responseMarkdown = normalizeMathDelimiters(
    unwrapOuterMarkdownFence(entry.response_preview),
  );

  return (
    <li className="border-t border-[var(--hairline)] py-5">
      <article>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="ui-label"
                style={{
                  color: entry.is_expired
                    ? "var(--coral)"
                    : "var(--teal)",
                }}
              >
                {entry.is_expired ? "Expired" : "Active"}
              </span>

              <code
                className="font-data text-[10px] text-[var(--text-faint)]"
                title={entry.cache_key}
              >
                {shortCacheKey(entry.cache_key)}
              </code>
            </div>

            <h3 className="mt-2 break-words text-base text-[var(--text)]">
              {entry.prompt}
            </h3>
          </div>

          {!isPendingDelete && (
            <button
              aria-label={`Delete ${entry.prompt}`}
              className="ui-label border-b border-[var(--coral)] pb-1 text-[var(--coral)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral)] disabled:opacity-50"
              disabled={isDeleting}
              type="button"
              onClick={onRequestDelete}
            >
              Delete
            </button>
          )}
        </header>

        <div className="mt-3 text-sm text-[var(--text-muted)] [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2">
          <ReactMarkdown
            components={previewMarkdownComponents}
            rehypePlugins={[rehypeKatex]}
            remarkPlugins={[remarkGfm, remarkMath]}
          >
            {responseMarkdown}
          </ReactMarkdown>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 min-[720px]:grid-cols-3">
          <div>
            <dt className="ui-label text-[var(--text-faint)]">
              Created
            </dt>
            <dd className="font-data mt-1 text-[10px] text-[var(--text-muted)]">
              {formatTimestamp(entry.created_at)}
            </dd>
          </div>

          <div>
            <dt className="ui-label text-[var(--text-faint)]">
              Expires
            </dt>
            <dd className="font-data mt-1 text-[10px] text-[var(--text-muted)]">
              {entry.expires_at === null
                ? "No expiry"
                : formatTimestamp(entry.expires_at)}
            </dd>
          </div>

          <div>
            <dt className="ui-label text-[var(--text-faint)]">
              TTL remaining
            </dt>
            <dd className="font-data mt-1 text-[10px] text-[var(--gold)]">
              {formatDuration(entry.remaining_ttl_seconds)}
            </dd>
          </div>

          <div>
            <dt className="ui-label text-[var(--text-faint)]">
              Entry hits
            </dt>
            <dd className="font-data mt-1 text-xs text-[var(--text-soft)]">
              {entry.hit_count}
            </dd>
          </div>

          <div>
            <dt className="ui-label text-[var(--text-faint)]">
              Last accessed
            </dt>
            <dd className="font-data mt-1 text-[10px] text-[var(--text-muted)]">
              {formatTimestamp(entry.last_accessed_at)}
            </dd>
          </div>

          <div>
            <dt className="ui-label text-[var(--text-faint)]">
              Recency rank
            </dt>
            <dd className="font-data mt-1 text-xs text-[var(--text-soft)]">
              #{entry.recency_rank}
            </dd>
          </div>
        </dl>

        {isPendingDelete && (
          <div
            aria-label={`Confirm deletion of ${entry.prompt}`}
            className="mt-4 border-l border-[var(--coral)] pl-4"
            role="group"
          >
            <p className="text-xs text-[var(--text-soft)]">
              Delete this entry? Cached responses using it will no longer be
              reused.
            </p>

            <div className="mt-3 flex flex-wrap gap-4">
              <button
                aria-label={`Confirm delete ${entry.prompt}`}
                className="ui-label text-[var(--coral)] disabled:opacity-50"
                disabled={isDeleting}
                type="button"
                onClick={onConfirmDelete}
              >
                {isDeleting ? "Deleting" : "Confirm delete"}
              </button>

              <button
                className="ui-label text-[var(--teal)] disabled:opacity-50"
                disabled={isDeleting}
                type="button"
                onClick={onCancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </article>
    </li>
  );
}

export function CacheInspector({
  refreshKey,
  onMutation,
}: CacheInspectorProps): JSX.Element {
  const [data, setData] =
    useState<CacheEntryListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CacheEntrySort>("newest");
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mutation, setMutation] =
    useState<"clear" | string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);

      const result = await listCacheEntries(
        {
          offset,
          limit: PAGE_SIZE,
          search,
          sort,
        },
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setData(result.data);
      } else {
        setLoadError(
          result.error.detail ??
            "Cache inspector data could not be loaded.",
        );
      }

      setIsLoading(false);
    }

    void load();

    return () => controller.abort();
  }, [offset, refreshKey, reloadKey, search, sort]);

  function refreshFromStart(): void {
    setOffset(0);
    setReloadKey((current) => current + 1);
  }

  async function confirmDeleteEntry(
    cacheKey: string,
  ): Promise<void> {
    setMutation(cacheKey);
    setActionError(null);

    const result = await deleteCacheEntry(cacheKey);

    setMutation(null);

    if (!result.ok) {
      setActionError(
        result.error.detail ?? "The cache entry was not deleted.",
      );
      return;
    }

    setPendingDelete(null);
    refreshFromStart();
    onMutation("delete");
  }

  async function confirmClearCache(): Promise<void> {
    setMutation("clear");
    setActionError(null);

    const result = await clearCache();

    setMutation(null);

    if (!result.ok) {
      setActionError(
        result.error.detail ?? "The cache was not cleared.",
      );
      return;
    }

    setConfirmClear(false);
    setPendingDelete(null);
    refreshFromStart();
    onMutation("clear");
  }

  const visibleStart =
    data === null || data.total === 0 ? 0 : data.offset + 1;

  const visibleEnd =
    data === null
      ? 0
      : Math.min(data.offset + data.items.length, data.total);

  const hasPrevious = data !== null && data.offset > 0;
  const hasNext = data?.has_more ?? false;
  const isMutating = mutation !== null;

  return (
    <section
      aria-labelledby="cache-inspector-heading"
      className="mt-14 border-t border-[var(--hairline)] pt-10"
    >
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2
            className="font-display text-2xl italic"
            id="cache-inspector-heading"
          >
            Cache inspector
          </h2>

          <p className="ui-label mt-1 text-[var(--text-faint)]">
            Live entry metadata / embeddings excluded
          </p>
        </div>

        <div className="flex flex-wrap gap-5">
          <button
            className="ui-label border-b border-[var(--teal)] pb-1 text-[var(--teal)] disabled:opacity-50"
            disabled={isLoading || isMutating}
            type="button"
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
          >
            {isLoading ? "Refreshing" : "Refresh"}
          </button>

          <button
            className="ui-label border-b border-[var(--coral)] pb-1 text-[var(--coral)] disabled:opacity-50"
            disabled={isMutating || data === null}
            type="button"
            onClick={() => {
              setPendingDelete(null);
              setConfirmClear(true);
            }}
          >
            Clear all entries
          </button>
        </div>
      </header>

      {confirmClear && (
        <div
          aria-label="Confirm clear cache"
          className="mt-5 border-l border-[var(--coral)] pl-4"
          role="group"
        >
          <p className="text-sm text-[var(--text-soft)]">
            Clear every cache entry and reset backend cache statistics?
          </p>

          <div className="mt-3 flex gap-5">
            <button
              className="ui-label text-[var(--coral)] disabled:opacity-50"
              disabled={mutation === "clear"}
              type="button"
              onClick={() => void confirmClearCache()}
            >
              {mutation === "clear"
                ? "Clearing"
                : "Confirm clear cache"}
            </button>

            <button
              className="ui-label text-[var(--teal)] disabled:opacity-50"
              disabled={mutation === "clear"}
              type="button"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-5 min-[680px]:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label
            className="ui-label text-[var(--text-muted)]"
            htmlFor="cache-search"
          >
            Search cached prompts
          </label>

          <input
            className="font-data mt-2 w-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--teal)]"
            id="cache-search"
            placeholder="Filter by original prompt"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
              setPendingDelete(null);
            }}
          />
        </div>

        <div>
          <label
            className="ui-label text-[var(--text-muted)]"
            htmlFor="cache-sort"
          >
            Sort cache entries
          </label>

          <select
            className="font-data mt-2 w-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--teal)]"
            id="cache-sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as CacheEntrySort);
              setOffset(0);
              setPendingDelete(null);
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most_hit">Most hit</option>
            <option value="nearest_expiry">
              Nearest expiry
            </option>
          </select>
        </div>
      </div>

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
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
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
              <EntryCard
                key={entry.cache_key}
                entry={entry}
                isDeleting={mutation === entry.cache_key}
                isPendingDelete={
                  pendingDelete === entry.cache_key
                }
                onCancelDelete={() => setPendingDelete(null)}
                onConfirmDelete={() =>
                  void confirmDeleteEntry(entry.cache_key)
                }
                onRequestDelete={() => {
                  setConfirmClear(false);
                  setPendingDelete(entry.cache_key);
                }}
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
              onClick={() =>
                setOffset((current) =>
                  Math.max(0, current - PAGE_SIZE),
                )
              }
            >
              Previous
            </button>

            <button
              className="ui-label text-[var(--teal)] disabled:text-[var(--text-faint)]"
              disabled={!hasNext || isLoading}
              type="button"
              onClick={() =>
                setOffset((current) => current + PAGE_SIZE)
              }
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}