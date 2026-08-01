import type { ApiResult } from "@/shared/api/types";
import type {
  BenchmarkDatasetListResponse,
  BenchmarkRunResponse,
  EvaluationDatasetPreview,
  EvaluationDatasetValidationRequest,
  EvaluationRunRequest,
} from "../types";
import {
  decodeBenchmarkDatasets,
  decodeBenchmarkRun,
  decodeEvaluationDatasetPreview,
} from "./benchmarkDecoders";
import { request, withSignal } from "@/shared/api/httpClient";

export async function getBenchmarkDatasets(
  signal?: AbortSignal,
): Promise<ApiResult<BenchmarkDatasetListResponse>> {
  return request(
    "/api/v1/evaluations/datasets",
    decodeBenchmarkDatasets,
    withSignal({ method: "GET" }, signal),
  );
}

export async function runBenchmark(
  payload: EvaluationRunRequest,
  signal?: AbortSignal,
): Promise<ApiResult<BenchmarkRunResponse>> {
  return request(
    "/api/v1/evaluations/runs",
    decodeBenchmarkRun,
    withSignal(
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      signal,
    ),
  );
}

export async function validateEvaluationDataset(
  payload: EvaluationDatasetValidationRequest,
  signal?: AbortSignal,
): Promise<ApiResult<EvaluationDatasetPreview>> {
  return request(
    "/api/v1/evaluations/datasets/validate",
    decodeEvaluationDatasetPreview,
    withSignal(
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      signal,
    ),
  );
}
