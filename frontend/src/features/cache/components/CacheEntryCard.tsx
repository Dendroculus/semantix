import { MarkdownContent } from "../../../shared/components/markdown/MarkdownContent";
import type { CacheEntryMetadata } from "../types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

interface CacheEntryCardProps {
  entry: CacheEntryMetadata;
  isDeleting: boolean;
  isPendingDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRequestDelete: () => void;
}

function formatTimestamp(value: string | null): string {
  return value === null
    ? "Never"
    : DATE_FORMATTER.format(new Date(value));
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

export function CacheEntryCard({
  entry,
  isDeleting,
  isPendingDelete,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
}: CacheEntryCardProps): JSX.Element {
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

        <MarkdownContent
          className="mt-3 text-sm text-[var(--text-muted)]"
          density="compact"
          markdown={entry.response_preview}
        />

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 min-[720px]:grid-cols-3">
          <div>
            <dt className="ui-label text-[var(--text-faint)]">Created</dt>
            <dd className="font-data mt-1 text-[10px] text-[var(--text-muted)]">
              {formatTimestamp(entry.created_at)}
            </dd>
          </div>
          <div>
            <dt className="ui-label text-[var(--text-faint)]">Expires</dt>
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
