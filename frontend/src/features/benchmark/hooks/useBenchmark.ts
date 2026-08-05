import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  canPersistEvaluationDatasets,
  canRunBenchmarks,
} from "@/features/auth/permissions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { ApiValidationIssue } from "@/shared/api/types";
import {
  apiErrorFromUnknown,
  dataFromApiResult,
} from "@/shared/query/apiResult";
import { benchmarkDatasetKeys } from "@/shared/query/queryKeys";
import {
  getBenchmarkDatasets,
  persistEvaluationDataset,
  runBenchmark,
  validateEvaluationDataset,
} from "../api/benchmarkApi";
import {
  compileThresholdSweep,
  type ThresholdSweep,
} from "../lib/thresholdSweep";
import type {
  BenchmarkDatasetId,
  BenchmarkDatasetSummary,
  BenchmarkRunResponse,
  EvaluationDatasetPreview,
  EvaluationRunRequest,
  PersistedEvaluationDatasetDetail,
} from "../types";

export const BENCHMARK_DATASET_STALE_TIME_MS = 10 * 60 * 1_000;
export const BENCHMARK_DATASET_GC_TIME_MS = 30 * 60 * 1_000;
export const EVALUATION_IMPORT_FILE_MAX_BYTES = 65_536;

export interface BenchmarkForm {
  datasetId: BenchmarkDatasetId;
  datasetSource: "builtin" | "custom" | "persisted";
  persistedDatasetId: string;
  persistedNamespace: string;
  historyNamespace: string;
  threshold: number;
  repetitions: number;
  resetCacheBeforeRun: boolean;
  costPerRequestUsd: number;
  costPer1kTokensUsd: number;
  sweepStart: number;
  sweepEnd: number;
  sweepStep: number;
}

export interface BenchmarkController {
  datasets: BenchmarkDatasetSummary[];
  datasetsLoading: boolean;
  datasetsRefreshing: boolean;
  canRun: boolean;
  canSaveImport: boolean;
  error: string | null;
  form: BenchmarkForm;
  importError: string | null;
  importFileName: string | null;
  importIssues: ApiValidationIssue[];
  isRunning: boolean;
  isSavingImport: boolean;
  isValidatingImport: boolean;
  preview: EvaluationDatasetPreview | null;
  persistedDataset: PersistedEvaluationDatasetDetail | null;
  result: BenchmarkRunResponse | null;
  selectedDataset: BenchmarkDatasetSummary | null;
  showWarning: boolean;
  statusMessage: string;
  sweep: ThresholdSweep;
  cancelRun: () => void;
  clearPersistedSelection: (datasetId: string) => void;
  confirmRun: () => Promise<void>;
  removeImport: () => void;
  reviewRun: () => Promise<void>;
  saveImport: (
    namespace: string | undefined,
    retentionDays: number,
  ) => Promise<PersistedEvaluationDatasetDetail | null>;
  selectPersistedDataset: (
    dataset: PersistedEvaluationDatasetDetail,
  ) => void;
  selectImportFile: (file: File) => Promise<void>;
  setForm: React.Dispatch<React.SetStateAction<BenchmarkForm>>;
}

const DEFAULT_FORM: BenchmarkForm = {
  datasetId: "quick",
  datasetSource: "builtin",
  persistedDatasetId: "",
  persistedNamespace: "",
  historyNamespace: "",
  threshold: 0.92,
  repetitions: 1,
  resetCacheBeforeRun: true,
  costPerRequestUsd: 0,
  costPer1kTokensUsd: 0,
  sweepStart: 0.7,
  sweepEnd: 0.98,
  sweepStep: 0.05,
};

function customSummary(
  preview: EvaluationDatasetPreview,
): BenchmarkDatasetSummary {
  return {
    dataset_id: preview.dataset_id,
    dataset_source: "inline",
    schema_version: preview.schema_version,
    version: String(preview.schema_version),
    digest: preview.digest,
    name: preview.name,
    description:
      preview.description ?? "Session-local imported evaluation dataset.",
    query_count: preview.case_count,
    expected_hits: preview.expected_hits,
    expected_misses: preview.expected_misses,
    categories: preview.categories,
  };
}

function persistedSummary(
  detail: PersistedEvaluationDatasetDetail,
): BenchmarkDatasetSummary {
  const expectedHits = detail.cases.filter(
    (item) => item.expected_cache_hit,
  ).length;
  const categories = [
    ...new Set(
      detail.cases.map((item) => item.category ?? "uncategorized"),
    ),
  ];
  return {
    dataset_id: detail.dataset_id,
    dataset_source: "persisted",
    schema_version: detail.schema_version,
    version: String(detail.schema_version),
    digest: detail.digest,
    name: detail.name,
    description:
      detail.description ?? "Persisted imported evaluation dataset.",
    query_count: detail.case_count,
    expected_hits: expectedHits,
    expected_misses: detail.case_count - expectedHits,
    categories,
  };
}

function requestFromForm(
  form: BenchmarkForm,
  evaluationThresholds: number[],
  importedDefinition: unknown,
): EvaluationRunRequest {
  let datasetSource: EvaluationRunRequest["dataset_source"];
  if (form.datasetSource === "custom") {
    datasetSource = { kind: "inline", definition: importedDefinition };
  } else if (form.datasetSource === "persisted") {
    datasetSource = {
      kind: "persisted",
      dataset_id: form.persistedDatasetId,
      namespace: form.persistedNamespace,
    };
  } else {
    datasetSource = { kind: "builtin", dataset_id: form.datasetId };
  }

  return {
    ...(form.datasetSource === "builtin" && form.historyNamespace.trim() !== ""
      ? { history_namespace: form.historyNamespace.trim() }
      : {}),
    dataset_source: datasetSource,
    threshold: form.threshold,
    evaluation_thresholds: evaluationThresholds,
    repetitions: form.repetitions,
    reset_cache_before_run: form.resetCacheBeforeRun,
    estimated_cost_per_request_usd: form.costPerRequestUsd,
    estimated_cost_per_1k_tokens_usd: form.costPer1kTokensUsd,
    allow_external_provider_calls: true,
  };
}

export function useBenchmark(): BenchmarkController {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BenchmarkForm>(DEFAULT_FORM);
  const [result, setResult] = useState<BenchmarkRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [importedDefinition, setImportedDefinition] = useState<unknown>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<EvaluationDatasetPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<ApiValidationIssue[]>([]);
  const [isValidatingImport, setIsValidatingImport] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [persistedDataset, setPersistedDataset] =
    useState<PersistedEvaluationDatasetDetail | null>(null);
  const activeRun = useRef<AbortController | null>(null);
  const activeSave = useRef<AbortController | null>(null);
  const activeValidation = useRef<AbortController | null>(null);
  const runSequence = useRef(0);
  const saveSequence = useRef(0);
  const validationSequence = useRef(0);
  const hasAppliedDefaultDataset = useRef(false);
  const previousPrincipal = useRef<string | null>(null);

  const datasetQuery = useQuery({
    queryKey: benchmarkDatasetKeys.catalog(),
    queryFn: async ({ signal }) =>
      dataFromApiResult(await getBenchmarkDatasets(signal)),
    staleTime: BENCHMARK_DATASET_STALE_TIME_MS,
    gcTime: BENCHMARK_DATASET_GC_TIME_MS,
  });

  useEffect(() => {
    if (
      datasetQuery.data === undefined ||
      hasAppliedDefaultDataset.current
    ) {
      return;
    }

    hasAppliedDefaultDataset.current = true;
    setForm((current) => ({
      ...current,
      datasetId: datasetQuery.data.default_dataset_id,
    }));
  }, [datasetQuery.data]);

  const authIdentity = useMemo(
    () =>
      `${auth.status}:${auth.session?.name ?? ""}:${
        auth.session?.role ?? ""
      }:${auth.session?.namespaces.join(",") ?? ""}`,
    [auth.session, auth.status],
  );

  function clearImport(): void {
    validationSequence.current += 1;
    activeValidation.current?.abort();
    activeValidation.current = null;
    setImportedDefinition(null);
    setImportFileName(null);
    setPreview(null);
    setImportError(null);
    setImportIssues([]);
    setIsValidatingImport(false);
    setShowWarning(false);
    setResult(null);
  }

  useEffect(() => {
    if (previousPrincipal.current === null) {
      previousPrincipal.current = authIdentity;
      return;
    }
    if (previousPrincipal.current !== authIdentity) {
      previousPrincipal.current = authIdentity;
      runSequence.current += 1;
      activeRun.current?.abort();
      activeRun.current = null;
      setIsRunning(false);
      saveSequence.current += 1;
      activeSave.current?.abort();
      activeSave.current = null;
      setIsSavingImport(false);
      clearImport();
      setPersistedDataset(null);
      setError(null);
      setStatusMessage("");
      setForm((current) => ({
        ...current,
        datasetSource: "builtin",
        persistedDatasetId: "",
        persistedNamespace: "",
        historyNamespace: "",
      }));
    }
  }, [authIdentity]);

  useEffect(
    () => () => {
      runSequence.current += 1;
      saveSequence.current += 1;
      validationSequence.current += 1;
      activeRun.current?.abort();
      activeSave.current?.abort();
      activeValidation.current?.abort();
      activeRun.current = null;
      activeSave.current = null;
      activeValidation.current = null;
    },
    [],
  );

  const datasets = datasetQuery.data?.datasets ?? [];
  const datasetsLoading =
    datasetQuery.data === undefined && datasetQuery.isPending;
  const datasetError = datasetQuery.isError
    ? apiErrorFromUnknown(datasetQuery.error).detail ??
      "Evaluation datasets could not be loaded."
    : null;
  const builtinDataset =
    datasets.find((dataset) => dataset.dataset_id === form.datasetId) ?? null;
  let selectedDataset = builtinDataset;
  if (form.datasetSource === "custom") {
    selectedDataset = preview === null ? null : customSummary(preview);
  } else if (form.datasetSource === "persisted") {
    selectedDataset =
      persistedDataset === null ? null : persistedSummary(persistedDataset);
  }
  let hasRunnableDataset = builtinDataset !== null;
  if (form.datasetSource === "custom") {
    hasRunnableDataset = importedDefinition !== null && preview !== null;
  } else if (form.datasetSource === "persisted") {
    hasRunnableDataset =
      persistedDataset !== null &&
      persistedDataset.dataset_id === form.persistedDatasetId &&
      persistedDataset.namespace === form.persistedNamespace;
  }
  const canRun = canRunBenchmarks(auth.status, auth.session);
  const canSaveImport = canPersistEvaluationDatasets(
    auth.status,
    auth.session,
  );
  const sweep = compileThresholdSweep(
    form.sweepStart,
    form.sweepEnd,
    form.sweepStep,
    form.threshold,
  );

  async function validateDefinition(
    definition: unknown,
  ): Promise<EvaluationDatasetPreview | null> {
    const controller = new AbortController();
    const validationId = validationSequence.current + 1;
    validationSequence.current = validationId;
    activeValidation.current?.abort();
    activeValidation.current = controller;
    setIsValidatingImport(true);
    setImportError(null);
    setImportIssues([]);

    try {
      const response = await validateEvaluationDataset(
        {
          dataset: definition,
          repetitions: form.repetitions,
          threshold_count: sweep.thresholds.length,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        validationId !== validationSequence.current
      ) {
        return null;
      }
      if (!response.ok) {
        setPreview(null);
        setImportError(
          response.error.detail ?? "The imported dataset is invalid.",
        );
        setImportIssues(response.error.issues ?? []);
        return null;
      }
      setPreview(response.data);
      return response.data;
    } finally {
      if (validationId === validationSequence.current) {
        activeValidation.current = null;
        setIsValidatingImport(false);
      }
    }
  }

  async function selectImportFile(file: File): Promise<void> {
    clearImport();
    const selectionId = validationSequence.current;
    setImportFileName(file.name);
    setForm((current) => ({ ...current, datasetSource: "custom" }));
    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportError("Choose a JSON file with a .json extension.");
      return;
    }
    if (file.size > EVALUATION_IMPORT_FILE_MAX_BYTES) {
      setImportError(
        `The selected file exceeds ${EVALUATION_IMPORT_FILE_MAX_BYTES.toLocaleString()} bytes.`,
      );
      return;
    }

    let definition: unknown;
    try {
      definition = JSON.parse(await file.text()) as unknown;
    } catch {
      if (selectionId !== validationSequence.current) {
        return;
      }
      setImportError("The selected file is not valid JSON.");
      return;
    }
    if (selectionId !== validationSequence.current) {
      return;
    }
    setImportedDefinition(definition);
    await validateDefinition(definition);
  }

  async function reviewRun(): Promise<void> {
    if (
      !canRunBenchmarks(auth.status, auth.session) ||
      sweep.error !== null ||
      !hasRunnableDataset
    ) {
      return;
    }
    if (form.datasetSource === "custom") {
      if (importedDefinition === null) {
        return;
      }
      const validated = await validateDefinition(importedDefinition);
      if (validated === null) {
        return;
      }
    }
    setShowWarning(true);
  }

  async function saveImport(
    namespace: string | undefined,
    retentionDays: number,
  ): Promise<PersistedEvaluationDatasetDetail | null> {
    if (
      !canSaveImport ||
      importedDefinition === null ||
      preview === null ||
      !Number.isSafeInteger(retentionDays) ||
      retentionDays < 1
    ) {
      return null;
    }
    const controller = new AbortController();
    const saveId = saveSequence.current + 1;
    saveSequence.current = saveId;
    activeSave.current?.abort();
    activeSave.current = controller;
    setIsSavingImport(true);
    setError(null);
    setStatusMessage("Saving the validated dataset...");
    try {
      const response = await persistEvaluationDataset(
        {
          ...(namespace === undefined ? {} : { namespace }),
          dataset: importedDefinition,
          retention_days: retentionDays,
        },
        controller.signal,
      );
      if (controller.signal.aborted || saveId !== saveSequence.current) {
        return null;
      }
      if (!response.ok) {
        setError(
          response.error.detail ?? "The validated dataset could not be saved.",
        );
        setStatusMessage("Dataset save failed.");
        return null;
      }
      await queryClient.invalidateQueries({
        queryKey: benchmarkDatasetKeys.persisted(),
      });
      if (controller.signal.aborted || saveId !== saveSequence.current) {
        return null;
      }
      setStatusMessage(
        `Saved ${response.data.name} in namespace ${response.data.namespace}.`,
      );
      return response.data;
    } finally {
      if (saveId === saveSequence.current) {
        activeSave.current = null;
        setIsSavingImport(false);
      }
    }
  }

  function selectPersistedDataset(
    dataset: PersistedEvaluationDatasetDetail,
  ): void {
    setPersistedDataset(dataset);
    setForm((current) => ({
      ...current,
      datasetSource: "persisted",
      persistedDatasetId: dataset.dataset_id,
      persistedNamespace: dataset.namespace,
    }));
    setResult(null);
    setShowWarning(false);
    setError(null);
    setStatusMessage(
      `Selected persisted dataset ${dataset.name} for the next run.`,
    );
  }

  function clearPersistedSelection(datasetId: string): void {
    setPersistedDataset((current) =>
      current?.dataset_id === datasetId ? null : current,
    );
    setForm((current) =>
      current.persistedDatasetId === datasetId
        ? {
            ...current,
            datasetSource: "builtin",
            persistedDatasetId: "",
            persistedNamespace: "",
          }
        : current,
    );
    setShowWarning(false);
  }

  async function confirmRun(): Promise<void> {
    if (
      !canRun ||
      !hasRunnableDataset ||
      sweep.error !== null ||
      (form.datasetSource === "custom" && importedDefinition === null)
    ) {
      return;
    }
    const controller = new AbortController();
    const runId = runSequence.current + 1;
    runSequence.current = runId;
    activeRun.current?.abort();
    activeRun.current = controller;
    setShowWarning(false);
    setIsRunning(true);
    setError(null);
    setStatusMessage("Evaluation run started.");

    try {
      const response = await runBenchmark(
        requestFromForm(form, sweep.thresholds, importedDefinition),
        controller.signal,
      );
      if (controller.signal.aborted || runId !== runSequence.current) {
        return;
      }

      if (!response.ok) {
        setError(response.error.detail ?? "The evaluation run failed.");
        setStatusMessage("Evaluation run failed.");
        return;
      }
      setResult(response.data);
      setStatusMessage("Evaluation run completed. Results are available below.");
    } finally {
      if (runId === runSequence.current) {
        activeRun.current = null;
        setIsRunning(false);
      }
    }
  }

  return {
    datasets,
    datasetsLoading,
    datasetsRefreshing:
      datasetQuery.data !== undefined && datasetQuery.isFetching,
    canRun,
    canSaveImport,
    error: error ?? datasetError,
    form,
    importError,
    importFileName,
    importIssues,
    isRunning,
    isSavingImport,
    isValidatingImport,
    preview,
    persistedDataset,
    result,
    selectedDataset,
    showWarning,
    statusMessage,
    sweep,
    cancelRun: () => setShowWarning(false),
    clearPersistedSelection,
    confirmRun,
    removeImport: clearImport,
    reviewRun,
    saveImport,
    selectPersistedDataset,
    selectImportFile,
    setForm,
  };
}
