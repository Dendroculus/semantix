import {
  useEffect,
  useRef,
  useState,
} from "react";

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

const EVALUATION_THRESHOLDS = [0.7, 0.8, 0.85, 0.9, 0.92, 0.95, 0.98];

export interface BenchmarkForm {
  datasetId: BenchmarkDatasetId;
  threshold: number;
  repetitions: number;
  resetCacheBeforeRun: boolean;
  costPerRequestUsd: number;
  costPer1kTokensUsd: number;
}

export interface BenchmarkController {
  datasets: BenchmarkDatasetSummary[];
  datasetsLoading: boolean;
  error: string | null;
  form: BenchmarkForm;
  isRunning: boolean;
  result: BenchmarkRunResponse | null;
  selectedDataset: BenchmarkDatasetSummary | null;
  showWarning: boolean;
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
};

function requestFromForm(form: BenchmarkForm): BenchmarkRunRequest {
  return {
    dataset_id: form.datasetId,
    threshold: form.threshold,
    evaluation_thresholds: EVALUATION_THRESHOLDS,
    repetitions: form.repetitions,
    reset_cache_before_run: form.resetCacheBeforeRun,
    estimated_cost_per_request_usd: form.costPerRequestUsd,
    estimated_cost_per_1k_tokens_usd: form.costPer1kTokensUsd,
    allow_external_provider_calls: true,
  };
}

export function useBenchmark(): BenchmarkController {
  const [datasets, setDatasets] = useState<BenchmarkDatasetSummary[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [form, setForm] = useState<BenchmarkForm>(DEFAULT_FORM);
  const [result, setResult] = useState<BenchmarkRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const activeRun = useRef<AbortController | null>(null);
  const runSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDatasets(): Promise<void> {
      const response = await getBenchmarkDatasets(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      setDatasetsLoading(false);
      if (!response.ok) {
        setError(
          response.error.detail ?? "Benchmark datasets could not be loaded.",
        );
        return;
      }
      setDatasets(response.data.datasets);
      setForm((current) => ({
        ...current,
        datasetId: response.data.default_dataset_id,
      }));
    }

    void loadDatasets();
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      runSequence.current += 1;
      activeRun.current?.abort();
      activeRun.current = null;
    },
    [],
  );

  const selectedDataset =
    datasets.find((dataset) => dataset.dataset_id === form.datasetId) ?? null;

  async function confirmRun(): Promise<void> {
    const controller = new AbortController();
    const runId = runSequence.current + 1;
    runSequence.current = runId;
    activeRun.current?.abort();
    activeRun.current = controller;
    setShowWarning(false);
    setIsRunning(true);
    setError(null);

    try {
      const response = await runBenchmark(
        requestFromForm(form),
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
        return;
      }
      setResult(response.data);
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
    error,
    form,
    isRunning,
    result,
    selectedDataset,
    showWarning,
    cancelRun: () => setShowWarning(false),
    confirmRun,
    reviewRun: () => setShowWarning(true),
    setForm,
  };
}
