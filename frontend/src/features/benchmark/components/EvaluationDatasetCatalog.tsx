import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type JSX } from 'react';

import {
  canDeleteEvaluationDatasets,
  canRunBenchmarks,
} from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { AuthStatus } from '@/features/auth/context/AuthContext';
import { isCacheNamespace } from '@/features/cache/namespace';
import {
  Alert,
  Button,
  EmptyState,
  InlineConfirmation,
} from '@/shared/components/ui';
import {
  formatBytes,
  formatCount,
  formatTimestamp,
} from '@/shared/lib/formatters';
import {
  apiErrorFromUnknown,
  dataFromApiResult,
} from '@/shared/query/apiResult';
import { benchmarkDatasetKeys } from '@/shared/query/queryKeys';
import {
  deletePersistedEvaluationDataset,
  getPersistedEvaluationDataset,
  getPersistedEvaluationDatasets,
} from '../api/benchmarkApi';
import type { BenchmarkController } from '../hooks/useBenchmark';
import type {
  PersistedEvaluationDatasetMetadata,
} from '../types';

const PAGE_SIZE = 12;
const CONTROL_CLASS =
  'font-data mt-2 min-h-11 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs text-(--text) outline-none focus-visible:border-(--gold) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gold)';

interface EvaluationDatasetCatalogProps {
  controller: BenchmarkController;
  onUseDataset: () => void;
}

interface SaveNamespaceControlProps {
  authStatus: AuthStatus;
  hasGlobalNamespace: boolean;
  namespaces: string[];
  saveNamespace: string;
  setSaveNamespace: (value: string) => void;
}

function defaultSaveNamespace(
  authStatus: AuthStatus,
  namespaces: string[],
): string {
  if (authStatus === 'disabled') {
    return 'default';
  }
  return namespaces.length === 1 ? (namespaces[0] ?? '') : '';
}

function defaultListNamespace(
  authStatus: AuthStatus,
  namespaces: string[],
  hasGlobalNamespace: boolean,
): string {
  if (authStatus !== 'authenticated' || hasGlobalNamespace) {
    return '';
  }
  return namespaces[0] ?? '';
}

function SaveNamespaceControl({
  authStatus,
  hasGlobalNamespace,
  namespaces,
  saveNamespace,
  setSaveNamespace,
}: Readonly<SaveNamespaceControlProps>): JSX.Element {
  if (authStatus === 'disabled' || hasGlobalNamespace) {
    const guidance =
      authStatus === 'disabled'
        ? 'Local development uses an explicit namespace; default is preselected.'
        : 'Wildcard access requires an explicit namespace.';
    return (
      <label>
        <span className="ui-label text-(--text-muted)">Namespace</span>
        <input
          aria-describedby="save-namespace-guidance"
          className={CONTROL_CLASS}
          placeholder="Authorized namespace"
          value={saveNamespace}
          onChange={(event) => setSaveNamespace(event.target.value)}
        />
        <span
          className="font-data mt-2 block text-[10px]/5 text-(--text-faint)"
          id="save-namespace-guidance"
        >
          {guidance}
        </span>
      </label>
    );
  }
  if (namespaces.length > 1) {
    return (
      <label>
        <span className="ui-label text-(--text-muted)">Namespace</span>
        <select
          className={CONTROL_CLASS}
          value={saveNamespace}
          onChange={(event) => setSaveNamespace(event.target.value)}
        >
          <option value="">Choose a namespace</option>
          {namespaces.map((namespace) => (
            <option key={namespace} value={namespace}>
              {namespace}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div>
      <p className="ui-label text-(--text-muted)">Namespace</p>
      <p className="font-data mt-2 wrap-break-word text-xs text-(--text-soft)">
        {namespaces[0] ?? 'No authorized namespace'}
      </p>
    </div>
  );
}

function Digest({
  value,
}: Readonly<{ value: string }>): JSX.Element {
  return (
    <code
      aria-label={`SHA-256 digest ${value}`}
      className="font-data text-[10px] text-(--text-faint)"
      title={value}
    >
      {value.slice(0, 12)}...
    </code>
  );
}

function DatasetMetadata({
  dataset,
}: Readonly<{
  dataset: PersistedEvaluationDatasetMetadata;
}>): JSX.Element {
  return (
    <dl className="font-data mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-[10px]/5">
      <div className="min-w-0">
        <dt className="text-(--text-faint)">Namespace</dt>
        <dd className="mt-1 wrap-break-word text-(--text-soft)" title={dataset.namespace}>
          {dataset.namespace}
        </dd>
      </div>
      <div>
        <dt className="text-(--text-faint)">Schema / digest</dt>
        <dd className="mt-1 text-(--text-soft)">
          v{dataset.schema_version} · <Digest value={dataset.digest} />
        </dd>
      </div>
      <div>
        <dt className="text-(--text-faint)">Cases / content</dt>
        <dd className="mt-1 text-(--text-soft)">
          {formatCount(dataset.case_count)} · {formatBytes(dataset.decoded_bytes)}
        </dd>
      </div>
      <div>
        <dt className="text-(--text-faint)">Created</dt>
        <dd className="mt-1 wrap-break-word text-(--text-soft)" title={dataset.created_at}>
          {formatTimestamp(dataset.created_at)}
        </dd>
      </div>
      <div className="col-span-2">
        <dt className="text-(--text-faint)">Expires</dt>
        <dd className="mt-1 wrap-break-word text-(--gold)" title={dataset.expires_at}>
          {formatTimestamp(dataset.expires_at)}
        </dd>
      </div>
    </dl>
  );
}

export function EvaluationDatasetCatalog({
  controller,
  onUseDataset,
}: Readonly<EvaluationDatasetCatalogProps>): JSX.Element {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const namespaces = useMemo(
    () => auth.session?.namespaces.filter((item) => item !== '*') ?? [],
    [auth.session],
  );
  const hasGlobalNamespace = auth.session?.namespaces.includes('*') ?? false;
  const [listNamespace, setListNamespace] = useState(
    defaultListNamespace(auth.status, namespaces, hasGlobalNamespace),
  );
  const [saveNamespace, setSaveNamespace] = useState(
    defaultSaveNamespace(auth.status, namespaces),
  );
  const [retentionDays, setRetentionDays] = useState(30);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [catalogStatus, setCatalogStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setSaveNamespace(defaultSaveNamespace(auth.status, namespaces));
    setListNamespace(
      defaultListNamespace(auth.status, namespaces, hasGlobalNamespace),
    );
    setOffset(0);
    setSelectedId(null);
    setPendingDelete(null);
  }, [
    auth.status,
    auth.session?.name,
    hasGlobalNamespace,
    namespaces,
  ]);

  const catalogQuery = useQuery({
    queryKey: benchmarkDatasetKeys.persistedList(
      listNamespace,
      offset,
      PAGE_SIZE,
    ),
    queryFn: async ({ signal }) =>
      dataFromApiResult(
        await getPersistedEvaluationDatasets(
          {
            ...(listNamespace === '' ? {} : { namespace: listNamespace }),
            offset,
            limit: PAGE_SIZE,
          },
          signal,
        ),
      ),
  });
  const catalog = catalogQuery.data;

  const defaultRetentionDays = catalog?.limits.default_retention_days;
  useEffect(() => {
    if (defaultRetentionDays !== undefined) {
      setRetentionDays(defaultRetentionDays);
    }
  }, [defaultRetentionDays]);

  const detailQuery = useQuery({
    queryKey: benchmarkDatasetKeys.persistedDetail(selectedId ?? ''),
    queryFn: async ({ signal }) => {
      if (selectedId === null) {
        throw new Error('No persisted dataset is selected.');
      }
      return dataFromApiResult(
        await getPersistedEvaluationDataset(selectedId, signal),
      );
    },
    enabled: selectedId !== null && catalog?.persistence_enabled === true,
  });

  const canDelete = canDeleteEvaluationDatasets(auth.status, auth.session);
  const canRun = canRunBenchmarks(auth.status, auth.session);
  const requiresSaveNamespace =
    auth.status === 'disabled' ||
    (auth.status === 'authenticated' &&
      (hasGlobalNamespace || namespaces.length > 1));
  const saveNamespaceValid =
    !requiresSaveNamespace || isCacheNamespace(saveNamespace);

  async function saveSessionDataset(): Promise<void> {
    if (!saveNamespaceValid) {
      return;
    }
    setActionError(null);
    const saved = await controller.saveImport(
      saveNamespace,
      retentionDays,
    );
    if (saved !== null) {
      setCatalogStatus(
        `Saved ${saved.name} in namespace ${saved.namespace}.`,
      );
      setSelectedId(saved.dataset_id);
    }
  }

  async function deleteDataset(
    dataset: PersistedEvaluationDatasetMetadata,
  ): Promise<void> {
    setDeletingId(dataset.dataset_id);
    setActionError(null);
    try {
      const response = await deletePersistedEvaluationDataset(
        dataset.dataset_id,
        dataset.namespace,
      );
      if (!response.ok) {
        setActionError(
          response.error.detail ?? 'The persisted dataset could not be deleted.',
        );
        return;
      }
      setPendingDelete(null);
      if (selectedId === dataset.dataset_id) {
        setSelectedId(null);
      }
      controller.clearPersistedSelection(dataset.dataset_id);
      await queryClient.invalidateQueries({
        queryKey: benchmarkDatasetKeys.persisted(),
      });
      setCatalogStatus(
        `Deleted ${dataset.name} from namespace ${dataset.namespace}.`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  function useSelectedDataset(): void {
    if (detailQuery.data === undefined) {
      return;
    }
    controller.selectPersistedDataset(detailQuery.data);
    onUseDataset();
  }

  const catalogError = catalogQuery.isError
    ? apiErrorFromUnknown(catalogQuery.error).detail ??
      'The persisted dataset catalog could not be loaded.'
    : null;
  const detailError = detailQuery.isError
    ? apiErrorFromUnknown(detailQuery.error).detail ??
      'The persisted dataset details could not be loaded.'
    : null;

  return (
    <section aria-labelledby="dataset-catalog-heading" className="mt-6">
      <header className="border-y border-(--hairline) py-5">
        <p className="ui-label text-(--gold)">Dataset sources</p>
        <h2
          className="font-display mt-2 text-2xl italic text-(--text)"
          id="dataset-catalog-heading"
        >
          Evaluation datasets
        </h2>
        <p className="mt-2 max-w-3xl text-sm/6 text-(--text-muted)">
          Built-in definitions stay code-owned. Session imports remain only in
          this page until an Operator explicitly saves a validated dataset to an
          authorized namespace.
        </p>
      </header>

      <section aria-labelledby="dataset-source-summary" className="mt-6">
        <h3 className="ui-label text-(--text-muted)" id="dataset-source-summary">
          Built-in and session sources
        </h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <article className="border border-(--hairline) p-4">
            <p className="ui-label text-(--teal)">Built-in</p>
            <p className="font-data mt-2 text-xs text-(--text-soft)">
              {controller.datasets.map((item) => item.name).join(', ')}
            </p>
            <p className="font-data mt-2 text-[10px]/5 text-(--text-faint)">
              Shipped with Semantix; not stored in the dataset catalog.
            </p>
          </article>
          <article className="border border-(--hairline) p-4">
            <p className="ui-label text-(--gold)">Session</p>
            {controller.preview === null ? (
              <p className="font-data mt-2 text-[10px]/5 text-(--text-faint)">
                No validated session import. Return to Runs to choose and
                validate a schema version 1 JSON file.
              </p>
            ) : (
              <>
                <h4 className="mt-2 wrap-break-word text-base text-(--text)">
                  {controller.preview.name}
                </h4>
                <p className="font-data mt-2 text-[10px]/5 text-(--text-muted)">
                  {formatCount(controller.preview.case_count)} cases ·{' '}
                  {formatBytes(controller.preview.decoded_bytes)} ·{' '}
                  <Digest value={controller.preview.digest} />
                </p>
              </>
            )}
          </article>
        </div>
      </section>

      {catalog?.persistence_enabled === false && (
        <Alert
          className="mt-6 border-l-2 border-(--gold) px-4 py-3"
          title="Persistence is disabled"
          tone="warning"
        >
          <p className="font-data mt-1 text-[10px]/5 text-(--text-soft)">
            This deployment uses session-only evaluation datasets. Built-in and
            imported runs still work, but validated imports cannot be saved
            across reloads.
          </p>
        </Alert>
      )}

      {catalog?.persistence_enabled === true &&
        controller.canSaveImport &&
        controller.preview !== null && (
          <section
            aria-labelledby="save-dataset-heading"
            className="mt-6 border border-(--hairline) p-4 sm:p-5"
          >
            <h3 className="ui-label text-(--teal)" id="save-dataset-heading">
              Save validated session dataset
            </h3>
            <p className="font-data mt-2 text-[10px]/5 text-(--text-muted)">
              Saving is explicit. Validation by itself never writes dataset
              content to PostgreSQL.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SaveNamespaceControl
                authStatus={auth.status}
                hasGlobalNamespace={hasGlobalNamespace}
                namespaces={namespaces}
                saveNamespace={saveNamespace}
                setSaveNamespace={setSaveNamespace}
              />
              <label>
                <span className="ui-label text-(--text-muted)">
                  Retention days
                </span>
                <input
                  className={CONTROL_CLASS}
                  max={catalog.limits.max_retention_days}
                  min="1"
                  type="number"
                  value={retentionDays}
                  onChange={(event) =>
                    setRetentionDays(Number(event.target.value))
                  }
                />
                <span className="font-data mt-2 block text-[10px]/5 text-(--text-faint)">
                  Maximum {formatCount(catalog.limits.max_retention_days)} days.
                </span>
              </label>
            </div>
            <Button
              className="mt-4"
              disabled={
                controller.isSavingImport ||
                !saveNamespaceValid ||
                !Number.isSafeInteger(retentionDays) ||
                retentionDays < 1 ||
                retentionDays > catalog.limits.max_retention_days
              }
              variant="primary"
              onClick={() => void saveSessionDataset()}
            >
              {controller.isSavingImport
                ? 'Saving validated dataset...'
                : 'Save validated dataset'}
            </Button>
          </section>
        )}

      {catalog?.persistence_enabled === true && (
        <section aria-labelledby="persisted-datasets-heading" className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3
                className="ui-label text-(--text-muted)"
                id="persisted-datasets-heading"
              >
                Persisted catalog
              </h3>
              <p className="font-data mt-2 text-[10px]/5 text-(--text-faint)">
                {formatCount(catalog.total)} active dataset
                {catalog.total === 1 ? '' : 's'} · maximum{' '}
                {formatCount(catalog.limits.max_persisted_per_namespace)} per
                namespace
              </p>
            </div>
            {namespaces.length > 1 && !hasGlobalNamespace && (
              <label className="w-full sm:w-64">
                <span className="ui-label text-(--text-muted)">
                  Catalog namespace
                </span>
                <select
                  className={CONTROL_CLASS}
                  value={listNamespace}
                  onChange={(event) => {
                    setListNamespace(event.target.value);
                    setOffset(0);
                  }}
                >
                  {namespaces.map((namespace) => (
                    <option key={namespace} value={namespace}>
                      {namespace}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {catalog.items.length === 0 ? (
            <EmptyState
              className="mt-5"
              description="Save a validated session dataset to make it available for later evaluation runs."
              title="No persisted datasets"
            />
          ) : (
            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {catalog.items.map((dataset) => (
                <li
                  key={dataset.dataset_id}
                  className="min-w-0 border border-(--hairline) p-4 sm:p-5"
                >
                  <article>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="ui-label text-(--teal)">Persisted</p>
                        <h4 className="mt-2 wrap-break-word text-lg text-(--text)">
                          {dataset.name}
                        </h4>
                      </div>
                      <Button
                        size="compact"
                        variant="secondary"
                        onClick={() => {
                          setSelectedId(dataset.dataset_id);
                          setActionError(null);
                        }}
                      >
                        View details
                      </Button>
                    </div>
                    {dataset.description !== null && (
                      <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm/6 text-(--text-muted)">
                        {dataset.description}
                      </p>
                    )}
                    <DatasetMetadata dataset={dataset} />
                    {canDelete && pendingDelete !== dataset.dataset_id && (
                      <Button
                        className="mt-4 text-(--coral-text)"
                        size="compact"
                        variant="link"
                        onClick={() => setPendingDelete(dataset.dataset_id)}
                      >
                        Delete dataset
                      </Button>
                    )}
                    {canDelete && pendingDelete === dataset.dataset_id && (
                      <InlineConfirmation
                        ariaLabel={`Confirm deletion of ${dataset.name} from namespace ${dataset.namespace}`}
                        className="mt-4"
                        confirmAriaLabel={`Confirm delete ${dataset.name} from namespace ${dataset.namespace}`}
                        confirmLabel="Confirm delete"
                        isPending={deletingId === dataset.dataset_id}
                        message={
                          <>
                            Delete <strong>{dataset.name}</strong> from namespace{' '}
                            <strong>{dataset.namespace}</strong>? Its{' '}
                            {formatCount(dataset.case_count)} cases will no
                            longer be available for evaluation runs.
                          </>
                        }
                        pendingLabel="Deleting dataset"
                        onCancel={() => setPendingDelete(null)}
                        onConfirm={() => void deleteDataset(dataset)}
                      />
                    )}
                  </article>
                </li>
              ))}
            </ul>
          )}

          {(offset > 0 || catalog.has_more) && (
            <nav
              aria-label="Persisted dataset pages"
              className="mt-5 flex flex-wrap items-center gap-4"
            >
              <Button
                disabled={offset === 0}
                size="compact"
                variant="secondary"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="font-data text-[10px] text-(--text-muted)">
                Showing {formatCount(offset + 1)}–
                {formatCount(offset + catalog.items.length)} of{' '}
                {formatCount(catalog.total)}
              </span>
              <Button
                disabled={!catalog.has_more}
                size="compact"
                variant="secondary"
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </nav>
          )}
        </section>
      )}

      {selectedId !== null && catalog?.persistence_enabled === true && (
        <section
          aria-labelledby="persisted-dataset-detail-heading"
          className="mt-7 border-y border-(--hairline) py-6"
        >
          <h3
            className="ui-label text-(--gold)"
            id="persisted-dataset-detail-heading"
          >
            Persisted dataset detail
          </h3>
          {detailQuery.isPending && (
            <output
              aria-live="polite"
              className="font-data mt-3 block text-[10px]/5 text-(--text-muted)"
            >
              Loading dataset details...
            </output>
          )}
          {detailQuery.data !== undefined && (
            <>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="wrap-break-word text-xl text-(--text)">
                    {detailQuery.data.name}
                  </h4>
                  <DatasetMetadata dataset={detailQuery.data} />
                </div>
                {canRun && (
                  <Button variant="primary" onClick={useSelectedDataset}>
                    Use for benchmark
                  </Button>
                )}
              </div>
              <ol className="mt-5 grid gap-3">
                {detailQuery.data.cases.map((item, index) => (
                  <li
                    key={item.case_id}
                    className="min-w-0 border-l border-(--hairline) pl-4"
                  >
                    <p className="ui-label wrap-break-word text-(--text-muted)">
                      {index + 1}. {item.case_id}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm/6 text-(--text-soft)">
                      {item.prompt}
                    </p>
                    <p className="font-data mt-2 wrap-break-word text-[10px]/5 text-(--text-faint)">
                      Expected {item.expected_cache_hit ? 'HIT' : 'MISS'} ·{' '}
                      {item.category ?? 'uncategorized'}
                      {item.expected_match_case_id === null
                        ? ''
                        : ` · match ${item.expected_match_case_id}`}
                    </p>
                    {item.note !== null && (
                      <p className="font-data mt-1 whitespace-pre-wrap wrap-break-word text-[10px]/5 text-(--text-muted)">
                        {item.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {(catalogError !== null ||
        detailError !== null ||
        actionError !== null) && (
        <Alert
          className="mt-6 border-l-2 border-(--coral) px-4 py-3"
          role="alert"
          title="Dataset catalog error"
          tone="error"
        >
          <p className="font-data mt-1 text-[10px]/5 text-(--text-soft)">
            {actionError ?? detailError ?? catalogError}
          </p>
        </Alert>
      )}

      {(catalogQuery.isPending || catalogQuery.isFetching) && (
        <output
          aria-live="polite"
          className="font-data mt-4 block text-[10px]/5 text-(--text-muted)"
        >
          {catalogQuery.isPending
            ? 'Loading persisted dataset catalog...'
            : 'Refreshing persisted dataset catalog...'}
        </output>
      )}
      {catalogStatus !== '' && (
        <output
          aria-live="polite"
          className="font-data mt-4 block text-[10px]/5 text-(--teal)"
        >
          {catalogStatus}
        </output>
      )}
    </section>
  );
}
