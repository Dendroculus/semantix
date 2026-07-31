import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiErrorFromUnknown,
  dataFromApiResult,
} from "@/shared/query/apiResult";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { canRunBenchmarks } from "@/features/auth/permissions";
import { benchmarkDatasetKeys } from "@/shared/query/queryKeys";
import {
  getBenchmarkDatasets,
  runBenchmark,
} from "../api/benchmarkApi";
import type {
  BenchmarkDatasetId,
  BenchmarkDatasetSummary,
  BenchmarkRunRequest,
  BenchmarkRunResponse,
} from "../types";
import {
  compileThresholdSweep,
  type ThresholdSweep,
} from "../lib/thresholdSweep";

export const BENCHMARK_DATASET_STALE_TIME_MS = 10 * 60 * 1_000;
export const BENCHMARK_DATASET_GC_TIME_MS = 30 * 60 * 1_000;

export interface BenchmarkForm {
  datasetId: BenchmarkDatasetId;
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
  isRunning: boolean;
  result: BenchmarkRunResponse | null;
  selectedDataset: BenchmarkDatasetSummary | null;
  showWarning: boolean;
  statusMessage: string;
  sweep: ThresholdSweep;
  cancelRun: () => void;
  confirmRun: () => Promise<void>;
  reviewRun: () => void;
  setForm: React.Dispatch<React.SetStateAction<BenchmarkForm>>;
}

const DEFAULT_FORM: BenchmarkForm = {
  datasetId: "quick",
  threshold: 0.92,
  repetitions: 1,
  resetCacheBeforeRun: true,
  costPerRequestUsd: 0,
  costPer1kTokensUsd: 0,
  sweepStart: 0.7,
  sweepEnd: 0.98,
  sweepStep: 0.05,
};

function requestFromForm(
  form: BenchmarkForm,
  evaluationThresholds: number[],
): BenchmarkRunRequest {
  return {
    dataset_id: form.datasetId,
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
  const activeRun = useRef<AbortController | null>(null);
  const runSequence = useRef(0);
  const hasAppliedDefaultDataset = useRef(false);

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

  useEffect(
    () => () => {
      runSequence.current += 1;
      activeRun.current?.abort();
      activeRun.current = null;
    },
    [],
  );

  const datasets = datasetQuery.data?.datasets ?? [];
  const datasetsLoading =
    datasetQuery.data === undefined && datasetQuery.isPending;
  const datasetError = datasetQuery.isError
    ? apiErrorFromUnknown(datasetQuery.error).detail ??
      "Benchmark datasets could not be loaded."
    : null;

  const selectedDataset =
    datasets.find((dataset) => dataset.dataset_id === form.datasetId) ?? null;
  const canRun = canRunBenchmarks(auth.status, auth.session);
  const sweep = compileThresholdSweep(
    form.sweepStart,
    form.sweepEnd,
    form.sweepStep,
    form.threshold,
  );

  async function confirmRun(): Promise<void> {
    if (!canRun || sweep.error !== null) {
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
        requestFromForm(form, sweep.thresholds),
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        runId !== runSequence.current
      ) {
        return;
      }

      if (!response.ok) {
        setError(response.error.detail ?? "The benchmark run failed.");
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
    isRunning,
    result,
    selectedDataset,
    showWarning,
    statusMessage,
    sweep,
    cancelRun: () => setShowWarning(false),
    confirmRun,
    reviewRun: () => {
      if (canRun && sweep.error === null) {
        setShowWarning(true);
      }
    },
    setForm,
  };
}
