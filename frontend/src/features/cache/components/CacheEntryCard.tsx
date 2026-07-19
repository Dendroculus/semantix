import type { ReactNode } from 'react';

import { MarkdownContent } from '@/shared/components/markdown/MarkdownContent';
import { InlineConfirmation } from '@/shared/components/ui';
import {
  formatCompactDuration,
  formatCount,
  formatTimestamp,
} from '@/shared/lib/formatters';
import type { CacheEntryMetadata } from '../types';

interface CacheEntryCardProps {
  entry: CacheEntryMetadata;
  isDeleting: boolean;
  isPendingDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRequestDelete: () => void;
}

interface EntryMetric {
  label: string;
  value: ReactNode;
  valueClassName: string;
}

function shortCacheKey(cacheKey: string): string {
  return `${cacheKey.slice(0, 10)}...${cacheKey.slice(-6)}`;
}

function EntryMetricItem({
  label,
  value,
  valueClassName,
}: Readonly<EntryMetric>): JSX.Element {
  return (
    <div>
      <dt className="ui-label text-(--text-faint)">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

export function CacheEntryCard({
  entry,
  isDeleting,
  isPendingDelete,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
}: Readonly<CacheEntryCardProps>): JSX.Element {
  const status = entry.is_expired
    ? {
        color: 'var(--coral)',
        label: 'Expired',
      }
    : {
        color: 'var(--teal)',
        label: 'Active',
      };

  const entryMetrics = [
    {
      label: 'Created',
      value: formatTimestamp(entry.created_at),
      valueClassName: 'font-data mt-1 text-[10px] text-(--text-muted)',
    },
    {
      label: 'Expires',
      value: formatTimestamp(entry.expires_at, 'No expiry'),
      valueClassName: 'font-data mt-1 text-[10px] text-(--text-muted)',
    },
    {
      label: 'TTL remaining',
      value: formatCompactDuration(entry.remaining_ttl_seconds, {
        fallback: 'No expiry',
      }),
      valueClassName: 'font-data mt-1 text-[10px] text-(--gold)',
    },
    {
      label: 'Entry hits',
      value: formatCount(entry.hit_count),
      valueClassName: 'font-data mt-1 text-xs text-(--text-soft)',
    },
    {
      label: 'Last accessed',
      value: formatTimestamp(entry.last_accessed_at),
      valueClassName: 'font-data mt-1 text-[10px] text-(--text-muted)',
    },
    {
      label: 'Recency rank',
      value: `#${formatCount(entry.recency_rank)}`,
      valueClassName: 'font-data mt-1 text-xs text-(--text-soft)',
    },
  ] satisfies EntryMetric[];

  return (
    <li className="border-t border-(--hairline) py-5 transition-colors hover:bg-[rgba(234,230,221,0.025)]">
      <article>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="ui-label" style={{ color: status.color }}>
                {status.label}
              </span>

              <code
                className="font-data text-[10px] text-(--text-faint)"
                title={entry.cache_key}
              >
                {shortCacheKey(entry.cache_key)}
              </code>

              <span className="font-data text-[10px] text-(--text-muted)">
                namespace / {entry.namespace}
              </span>
            </div>

            <h3 className="mt-2 wrap-break-word text-base text-(--text)">
              {entry.prompt}
            </h3>
          </div>

          {!isPendingDelete && (
            <button
              aria-label={`Delete ${entry.prompt}`}
              className="ui-label min-h-9 border-b border-(--coral) px-1 py-2 text-(--coral) transition-colors hover:text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--coral) active:translate-y-px disabled:opacity-50"
              disabled={isDeleting}
              type="button"
              onClick={onRequestDelete}
            >
              Delete
            </button>
          )}
        </header>

        <MarkdownContent
          className="mt-3 text-sm text-(--text-muted)"
          density="compact"
          markdown={entry.response_preview}
        />

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 min-[720px]:grid-cols-3">
          {entryMetrics.map((metric) => (
            <EntryMetricItem key={metric.label} {...metric} />
          ))}
        </dl>

        {isPendingDelete && (
          <InlineConfirmation
            ariaLabel={`Confirm deletion of ${entry.prompt}`}
            className="mt-4"
            confirmAriaLabel={`Confirm delete ${entry.prompt}`}
            confirmLabel="Confirm delete"
            isPending={isDeleting}
            message="Delete this entry? Cached responses using it will no longer be reused."
            messageClassName="text-xs"
            pendingLabel="Deleting"
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
          />
        )}
      </article>
    </li>
  );
}
