import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type JSX } from 'react';

import {
  deleteEvaluationRunHistory,
  getEvaluationRunHistory,
  getEvaluationRunHistoryDetail,
} from '@/features/benchmark/api/benchmarkApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { canDeleteEvaluationRunHistory } from '@/features/auth/permissions';
import { isCacheNamespace } from '@/features/cache/namespace';
import {
  Alert,
  Button,
  EmptyState,
  InlineConfirmation,
} from '@/shared/components/ui';
import {
  formatCount,
  formatLatency,
  formatPercent,
  formatTimestamp,
} from '@/shared/lib/formatters';
import {
  apiErrorFromUnknown,
  dataFromApiResult,
} from '@/shared/query/apiResult';
import { benchmarkHistoryKeys } from '@/shared/query/queryKeys';

import type { EvaluationRunHistoryItem } from '@/features/benchmark/types';
import { EvaluationRunHistoryDetailPanel } from './EvaluationRunHistoryDetail';

const PAGE_SIZE = 12;
const CONTROL_CLASS =
  'font-data min-h-11 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs text-(--text) outline-none focus-visible:border-(--gold) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gold)';

function defaultNamespace(
  status: ReturnType<typeof useAuth>['status'],
  namespaces: string[],
  hasGlobalNamespace: boolean,
): string {
  if (status === 'authenticated' && !hasGlobalNamespace) {
    return namespaces[0] ?? '';
  }
  return '';
}

function stateClass(state: EvaluationRunHistoryItem['terminal_state']): string {
  if (state === 'completed') {
    return 'text-(--teal)';
  }
  if (state === 'timed_out') {
    return 'text-(--gold)';
  }
  return 'text-(--coral)';
}

function RunSummary({
  item,
}: Readonly<{ item: EvaluationRunHistoryItem }>): JSX.Element {
  if (item.metrics === null) {
    return (
      <p className="font-data mt-3 text-[10px]/5 text-(--text-muted)">
        {item.failure_code}
        {item.safe_failure_detail === null
          ? ''
          : ` · ${item.safe_failure_detail}`}
      </p>
    );
  }

  return (
    <dl className="font-data mt-3 grid grid-cols-3 gap-3 text-[10px]/5">
      <div>
        <dt className="text-(--text-faint)">Hit rate</dt>
        <dd className="mt-1 text-(--text-soft)">
          {formatPercent(item.metrics.hit_rate)}
        </dd>
      </div>
      <div>
        <dt className="text-(--text-faint)">F1</dt>
        <dd className="mt-1 text-(--text-soft)">
          {formatPercent(item.metrics.f1_score)}
        </dd>
      </div>
      <div>
        <dt className="text-(--text-faint)">Avg latency</dt>
        <dd className="mt-1 text-(--text-soft)">
          {formatLatency(item.metrics.average_latency_ms)}
        </dd>
      </div>
    </dl>
  );
}

export function EvaluationRunHistory(): JSX.Element {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const namespaces = useMemo(
    () => auth.session?.namespaces.filter((item) => item !== '*') ?? [],
    [auth.session],
  );
  const hasGlobalNamespace = auth.session?.namespaces.includes('*') ?? false;
  const initialNamespace = defaultNamespace(
    auth.status,
    namespaces,
    hasGlobalNamespace,
  );

  const [namespaceInput, setNamespaceInput] = useState(initialNamespace);
  const [namespace, setNamespace] = useState(initialNamespace);
  const [namespaceError, setNamespaceError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const nextNamespace = defaultNamespace(
      auth.status,
      namespaces,
      hasGlobalNamespace,
    );
    setNamespaceInput(nextNamespace);
    setNamespace(nextNamespace);
    setOffset(0);
    setSelectedRunId(null);
    setPendingDelete(null);
    setNamespaceError(null);
  }, [
    auth.session?.name,
    auth.status,
    hasGlobalNamespace,
    namespaces,
  ]);

  const catalogQuery = useQuery({
    queryKey: benchmarkHistoryKeys.list(namespace, offset, PAGE_SIZE),
    queryFn: async ({ signal }) =>
      dataFromApiResult(
        await getEvaluationRunHistory(
          {
            ...(namespace === '' ? {} : { namespace }),
            offset,
            limit: PAGE_SIZE,
          },
          signal,
        ),
      ),
  });

  const detailQuery = useQuery({
    queryKey: benchmarkHistoryKeys.detail(selectedRunId ?? ''),
    queryFn: async ({ signal }) => {
      if (selectedRunId === null) {
        throw new Error('No retained evaluation run is selected.');
      }
      return dataFromApiResult(
        await getEvaluationRunHistoryDetail(selectedRunId, signal),
      );
    },
    enabled:
      selectedRunId !== null &&
      catalogQuery.data?.retention_enabled === true,
  });

  const canDelete = canDeleteEvaluationRunHistory(
    auth.status,
    auth.session,
  );

  function applyNamespace(): void {
    const trimmed = namespaceInput.trim();
    if (trimmed !== '' && !isCacheNamespace(trimmed)) {
      setNamespaceError('Enter a valid authorized namespace.');
      return;
    }
    setNamespaceError(null);
    setNamespace(trimmed);
    setOffset(0);
    setSelectedRunId(null);
    setPendingDelete(null);
  }

  async function deleteRun(item: EvaluationRunHistoryItem): Promise<void> {
    setDeletingRunId(item.run_id);
    setActionError(null);
    try {
      const response = await deleteEvaluationRunHistory(
        item.run_id,
        item.namespace,
      );
      if (!response.ok) {
        setActionError(
          response.error.detail ?? 'The retained run could not be deleted.',
        );
        return;
      }

      setPendingDelete(null);
      if (selectedRunId === item.run_id) {
        setSelectedRunId(null);
      }
      await queryClient.invalidateQueries({
        queryKey: benchmarkHistoryKeys.all,
      });
      setStatusMessage(
        `Deleted retained run ${item.run_id.slice(0, 12)} from ${item.namespace}.`,
      );
    } finally {
      setDeletingRunId(null);
    }
  }

  const catalog = catalogQuery.data;
  const catalogError = catalogQuery.isError
    ? apiErrorFromUnknown(catalogQuery.error).detail ??
      'Evaluation run history could not be loaded.'
    : null;
  const detailError = detailQuery.isError
    ? apiErrorFromUnknown(detailQuery.error).detail ??
      'The retained run detail could not be loaded.'
    : null;


  let namespaceControl: JSX.Element;

  if (auth.status === 'authenticated' &&
        !hasGlobalNamespace &&
        namespaces.length > 1) {
    namespaceControl = (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="sr-only">History namespace</span>
              <select
                aria-label="History namespace"
                className={CONTROL_CLASS}
                value={namespaceInput}
                onChange={(event) => {
                  setNamespaceInput(event.target.value);
                  setNamespace(event.target.value);
                  setOffset(0);
                  setSelectedRunId(null);
                }}
              >
                {namespaces.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
  } else if (auth.status === 'authenticated' && !hasGlobalNamespace) {
    namespaceControl = (
          <p className="font-data mt-3 text-xs text-(--text-soft)">
            {namespace || 'No authorized namespace'}
          </p>
        );
  } else {
    namespaceControl = (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="sr-only">History namespace filter</span>
              <input
                aria-describedby="history-namespace-guidance"
                aria-label="History namespace filter"
                className={CONTROL_CLASS}
                placeholder="All namespaces"
                value={namespaceInput}
                onChange={(event) => setNamespaceInput(event.target.value)}
              />
            </label>
            <Button size="compact" variant="secondary" onClick={applyNamespace}>
              Apply namespace
            </Button>
          </div>
        );
  }

  return (
    <section aria-labelledby="run-history-heading" className="mt-6">
      <header className="border-y border-(--hairline) py-5">
        <p className="ui-label text-(--gold)">Durable evaluation evidence</p>
        <h2
          className="font-display mt-2 text-2xl italic text-(--text)"
          id="run-history-heading"
        >
          Run history
        </h2>
        <p className="mt-2 max-w-3xl text-sm/6 text-(--text-muted)">
          Browse terminal aggregate results retained by namespace. History never
          stores per-query prompts, generated responses, or matched cache keys.
        </p>
      </header>

      <section
        aria-labelledby="run-history-filter-heading"
        className="mt-5 border border-(--hairline) p-4"
      >
        <h3
          className="ui-label text-(--text-muted)"
          id="run-history-filter-heading"
        >
          Namespace scope
        </h3>

        {namespaceControl}

        <p
          className="font-data mt-2 text-[10px]/5 text-(--text-faint)"
          id="history-namespace-guidance"
        >
          Wildcard access may leave this blank to list all authorized history.
          Deletion always remains scoped to the run&apos;s retained namespace.
        </p>
        {namespaceError !== null && (
          <p
            className="font-data mt-2 text-[10px]/5 text-(--coral)"
            role="alert"
          >
            {namespaceError}
          </p>
        )}
      </section>

      {catalogQuery.isPending && (
        <output
          aria-live="polite"
          className="font-data mt-5 block text-[10px]/5 text-(--text-muted)"
        >
          Loading retained evaluation runs...
        </output>
      )}

      {catalogError !== null && (
        <Alert className="mt-5" role="alert" title="History unavailable" tone="error">
          <p className="font-data mt-1 text-[10px]/5 text-(--text-soft)">
            {catalogError}
          </p>
        </Alert>
      )}

      {catalog?.retention_enabled === false && (
        <Alert
          className="mt-5 border-l-2 border-(--gold) px-4 py-3"
          title="Durable history is disabled"
          tone="warning"
        >
          <p className="font-data mt-1 text-[10px]/5 text-(--text-soft)">
            This deployment does not retain evaluation runs in PostgreSQL.
            Measured runs can still complete normally, but no durable history is
            available to browse.
          </p>
        </Alert>
      )}

      {actionError !== null && (
        <Alert className="mt-5" role="alert" title="History action failed" tone="error">
          <p className="font-data mt-1 text-[10px]/5 text-(--text-soft)">
            {actionError}
          </p>
        </Alert>
      )}

      {statusMessage !== '' && (
        <output
          aria-live="polite"
          className="font-data mt-4 block text-[10px]/5 text-(--teal)"
        >
          {statusMessage}
        </output>
      )}

      {catalog?.retention_enabled === true && catalog.items.length === 0 && (
        <EmptyState
          className="mt-6 py-6"
          description="No unexpired terminal evaluation runs are retained in this namespace scope."
          title="No retained runs"
        />
      )}

      {catalog?.retention_enabled === true && catalog.items.length > 0 && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {catalog.items.map((item) => (
              <article
                className="min-w-0 border border-(--hairline) p-4"
                key={item.run_id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`ui-label ${stateClass(item.terminal_state)}`}>
                      {item.terminal_state.replace('_', ' ')}
                    </p>
                    <h3 className="mt-2 wrap-break-word text-base text-(--text)">
                      {item.dataset.name}
                    </h3>
                    <code
                      className="font-data mt-1 block text-[10px] text-(--text-faint)"
                      title={item.run_id}
                    >
                      {item.run_id.slice(0, 12)}...
                    </code>
                  </div>
                  <span className="font-data wrap-break-word text-[10px] text-(--text-faint)">
                    {item.namespace}
                  </span>
                </div>

                <RunSummary item={item} />

                <dl className="font-data mt-4 grid grid-cols-2 gap-3 border-t border-(--hairline) pt-3 text-[10px]/5">
                  <div>
                    <dt className="text-(--text-faint)">Completed</dt>
                    <dd
                      className="mt-1 text-(--text-soft)"
                      title={item.completed_at}
                    >
                      {formatTimestamp(item.completed_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--text-faint)">Expires</dt>
                    <dd className="mt-1 text-(--gold)" title={item.expires_at}>
                      {formatTimestamp(item.expires_at)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    size="compact"
                    variant="secondary"
                    onClick={() => {
                      setActionError(null);
                      setSelectedRunId(item.run_id);
                    }}
                  >
                    View details
                  </Button>
                  {canDelete && pendingDelete !== item.run_id && (
                    <Button
                      size="compact"
                      variant="link"
                      onClick={() => {
                        setActionError(null);
                        setPendingDelete(item.run_id);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>

                {pendingDelete === item.run_id && (
                  <InlineConfirmation
                    ariaLabel={`Delete retained run ${item.run_id}`}
                    className="mt-4"
                    confirmLabel="Delete retained run"
                    isPending={deletingRunId === item.run_id}
                    message={
                      <>
                        Delete this retained aggregate from{' '}
                        <strong>{item.namespace}</strong>? This does not delete
                        the source dataset.
                      </>
                    }
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={() => void deleteRun(item)}
                    pendingLabel="Deleting..."
                  />
                )}
              </article>
            ))}
          </div>

          <nav
            aria-label="Evaluation run history pagination"
            className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-(--hairline) pt-4"
          >
            <p className="font-data text-[10px]/5 text-(--text-faint)">
              Showing {formatCount(offset + 1)}-
              {formatCount(offset + catalog.items.length)} of{' '}
              {formatCount(catalog.total)}
            </p>
            <div className="flex gap-3">
              <Button
                disabled={offset === 0}
                size="compact"
                variant="secondary"
                onClick={() => {
                  setOffset(Math.max(0, offset - PAGE_SIZE));
                  setSelectedRunId(null);
                }}
              >
                Previous
              </Button>
              <Button
                disabled={!catalog.has_more}
                size="compact"
                variant="secondary"
                onClick={() => {
                  setOffset(offset + PAGE_SIZE);
                  setSelectedRunId(null);
                }}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}

      {detailQuery.isPending && selectedRunId !== null && (
        <output
          aria-live="polite"
          className="font-data mt-5 block text-[10px]/5 text-(--text-muted)"
        >
          Loading retained run detail...
        </output>
      )}

      {detailError !== null && (
        <Alert
          className="mt-5"
          role="alert"
          title="Run detail unavailable"
          tone="error"
        >
          <p className="font-data mt-1 text-[10px]/5 text-(--text-soft)">
            {detailError}
          </p>
        </Alert>
      )}

      {detailQuery.data !== undefined && (
        <EvaluationRunHistoryDetailPanel
          detail={detailQuery.data}
          onClose={() => setSelectedRunId(null)}
        />
      )}
    </section>
  );
}
