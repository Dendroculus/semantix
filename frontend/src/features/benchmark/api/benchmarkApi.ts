import type { ApiResult } from "../../../shared/api/types";
import type {
  BenchmarkDatasetListResponse,
  BenchmarkRunRequest,
  BenchmarkRunResponse,
} from "../types";
import {
  decodeBenchmarkDatasets,
  decodeBenchmarkRun,
} from "./benchmarkDecoders";
import { request, withSignal } from "../../../shared/api/httpClient";

export async function getBenchmarkDatasets(
  signal?: AbortSignal,
): Promise<ApiResult<BenchmarkDatasetListResponse>> {
  return request(
    "/api/v1/benchmarks/datasets",
    decodeBenchmarkDatasets,
    withSignal({ method: "GET" }, signal),
  );
}

export async function runBenchmark(
  payload: BenchmarkRunRequest,
  signal?: AbortSignal,
): Promise<ApiResult<BenchmarkRunResponse>> {
  return request(
    "/api/v1/benchmarks/run",
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
