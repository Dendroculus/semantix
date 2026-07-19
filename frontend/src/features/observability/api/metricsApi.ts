import { request, withSignal } from "@/shared/api/httpClient";
import type { ApiResult } from "@/shared/api/types";
import {
  isFiniteNumber,
  isIsoDate,
  isNonNegativeInteger,
  isRecord,
} from "@/shared/api/validators";

import type { RuntimeMetrics } from "../types";

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNullableNonNegativeNumber(
  value: unknown,
): value is number | null {
  return value === null || isNonNegativeNumber(value);
}

function decodeRuntimeMetrics(value: unknown): RuntimeMetrics {
  if (
    !isRecord(value) ||
    typeof value.observed_at !== "string" ||
    !isIsoDate(value.observed_at) ||
    !isNonNegativeNumber(value.uptime_seconds) ||
    !isNonNegativeInteger(value.request_count) ||
    !isNonNegativeInteger(value.error_count) ||
    !isNonNegativeInteger(value.cache_hits) ||
    !isNonNegativeInteger(value.cache_misses) ||
    !isNonNegativeInteger(value.provider_calls) ||
    !isNonNegativeInteger(value.in_flight_coalesced_requests) ||
    !isNullableNonNegativeNumber(value.average_latency_ms) ||
    !isNullableNonNegativeNumber(value.p95_latency_ms) ||
    !isNonNegativeInteger(value.latency_sample_size) ||
    !isNonNegativeInteger(value.cache_size) ||
    !isNonNegativeInteger(value.evictions) ||
    !isNonNegativeInteger(value.expirations)
  ) {
    throw new Error("Invalid runtime metrics response");
  }

  return {
    observed_at: value.observed_at,
    uptime_seconds: value.uptime_seconds,
    request_count: value.request_count,
    error_count: value.error_count,
    cache_hits: value.cache_hits,
    cache_misses: value.cache_misses,
    provider_calls: value.provider_calls,
    in_flight_coalesced_requests:
      value.in_flight_coalesced_requests,
    average_latency_ms: value.average_latency_ms,
    p95_latency_ms: value.p95_latency_ms,
    latency_sample_size: value.latency_sample_size,
    cache_size: value.cache_size,
    evictions: value.evictions,
    expirations: value.expirations,
  };
}

export function getRuntimeMetrics(
  signal?: AbortSignal,
): Promise<ApiResult<RuntimeMetrics>> {
  return request(
    "/api/v1/metrics",
    decodeRuntimeMetrics,
    withSignal({ method: "GET" }, signal),
  );
}
