import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { canRunBenchmarks } from "@/features/auth/permissions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { ApiValidationIssue } from "@/shared/api/types";
import {
  apiErrorFromUnknown,
  dataFromApiResult,
} from "@/shared/query/apiResult";
import { benchmarkDatasetKeys } from "@/shared/query/queryKeys";
import {
  getBenchmarkDatasets,
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
} from "../types";

export const BENCHMARK_DATASET_STALE_TIME_MS = 10 * 60 * 1_000;
export const BENCHMARK_DATASET_GC_TIME_MS = 30 * 60 * 1_000;
export const EVALUATION_IMPORT_FILE_MAX_BYTES = 65_536;

export interface BenchmarkForm {
  datasetId: BenchmarkDatasetId;
  datasetSource: "builtin" | "custom";
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
  error: string | null;
  form: BenchmarkForm;
  importError: string | null;
  importFileName: string | null;
  importIssues: ApiValidationIssue[];
  isRunning: boolean;
  isValidatingImport: boolean;
  preview: EvaluationDatasetPreview | null;
  result: BenchmarkRunResponse | null;
  selectedDataset: BenchmarkDatasetSummary | null;
  showWarning: boolean;
  statusMessage: string;
  sweep: ThresholdSweep;
  cancelRun: () => void;
  confirmRun: () => Promise<void>;
  removeImport: () => void;
  reviewRun: () => Promise<void>;
  selectImportFile: (file: File) => Promise<void>;
  setForm: React.Dispatch<React.SetStateAction<BenchmarkForm>>;
}

const DEFAULT_FORM: BenchmarkForm = {
  datasetId: "quick",
  datasetSource: "builtin",
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

function requestFromForm(
  form: BenchmarkForm,
  evaluationThresholds: number[],
  importedDefinition: unknown,
): EvaluationRunRequest {
  return {
    dataset_source:
      form.datasetSource === "custom"
        ? { kind: "inline", definition: importedDefinition }
        : { kind: "builtin", dataset_id: form.datasetId },
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
  const activeRun = useRef<AbortController | null>(null);
  const activeValidation = useRef<AbortController | null>(null);
  const runSequence = useRef(0);
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
      clearImport();
    }
  }, [authIdentity]);

  useEffect(
    () => () => {
      runSequence.current += 1;
      validationSequence.current += 1;
      activeRun.current?.abort();
      activeValidation.current?.abort();
      activeRun.current = null;
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
  }
  const hasRunnableDataset =
    form.datasetSource === "builtin"
      ? builtinDataset !== null
      : importedDefinition !== null && preview !== null;
  const canRun = canRunBenchmarks(auth.status, auth.session);
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
      sweep.error !== null
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
    } else if (builtinDataset === null) {
      return;
    }
    setShowWarning(true);
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
    error: error ?? datasetError,
    form,
    importError,
    importFileName,
    importIssues,
    isRunning,
    isValidatingImport,
    preview,
    result,
    selectedDataset,
    showWarning,
    statusMessage,
    sweep,
    cancelRun: () => setShowWarning(false),
    confirmRun,
    removeImport: clearImport,
    reviewRun,
    selectImportFile,
    setForm,
  };
}
