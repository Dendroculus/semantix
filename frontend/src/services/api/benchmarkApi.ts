import type { ApiResult } from "../../types/api";
import type {
  BenchmarkDatasetListResponse,
  BenchmarkRunRequest,
  BenchmarkRunResponse,
} from "../../types/benchmark";
import {
  decodeBenchmarkDatasets,
  decodeBenchmarkRun,
} from "./benchmarkDecoders";
import { request, withSignal } from "./httpClient";

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
