import { API_BASE_URL } from "../config/env";
import type {
  ApiError,
  ApiResult,
  CacheStatsResponse,
  CacheThresholdResponse,
  ClearCacheResponse,
  QueryRequest,
  QueryResponse,
} from "../types/api";

type Decoder<T> = (value: unknown) => T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function decodeQueryResponse(value: unknown): QueryResponse {
  if (
    !isRecord(value) ||
    typeof value.response !== "string" ||
    typeof value.cache_hit !== "boolean" ||
    !isFiniteNumber(value.latency_ms) ||
    !(value.similarity_score === null || isFiniteNumber(value.similarity_score))
  ) {
    throw new Error("Invalid query response");
  }

  return {
    response: value.response,
    cache_hit: value.cache_hit,
    similarity_score: value.similarity_score,
    latency_ms: value.latency_ms,
  };
}

function decodeCacheStats(value: unknown): CacheStatsResponse {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.size) ||
    !isFiniteNumber(value.hits) ||
    !isFiniteNumber(value.misses) ||
    !isFiniteNumber(value.hit_rate)
  ) {
    throw new Error("Invalid cache stats response");
  }

  return {
    size: value.size,
    hits: value.hits,
    misses: value.misses,
    hit_rate: value.hit_rate,
  };
}

function decodeClearCache(value: unknown): ClearCacheResponse {
  if (!isRecord(value) || value.cleared !== true) {
    throw new Error("Invalid clear-cache response");
  }

  return { cleared: true };
}

function decodeCacheThreshold(value: unknown): CacheThresholdResponse {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.threshold) ||
    value.threshold < 0 ||
    value.threshold > 1
  ) {
    throw new Error("Invalid cache-threshold response");
  }

  return { threshold: value.threshold };
}

function decodeApiError(value: unknown, status: number): ApiError {
  if (
    isRecord(value) &&
    typeof value.error === "string" &&
    (value.detail === null || typeof value.detail === "string")
  ) {
    return { code: value.error, detail: value.detail, status };
  }

  return {
    code: "invalid_error_response",
    detail: "The server returned an unexpected response.",
    status,
  };
}

async function request<T>(
  path: string,
  decoder: Decoder<T>,
  init: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "network_error",
        detail: error instanceof Error ? error.message : "Network request failed.",
        status: null,
      },
    };
  }

  let payload: unknown;

  try {
    const text = await response.text();
    payload = text.trim() === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        detail: "The server returned malformed JSON.",
        status: response.status,
      },
    };
  }

  if (!response.ok) {
    return { ok: false, error: decodeApiError(payload, response.status) };
  }

  try {
    return { ok: true, data: decoder(payload) };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        detail: error instanceof Error ? error.message : "Invalid response.",
        status: response.status,
      },
    };
  }
}

function withSignal(init: RequestInit, signal?: AbortSignal): RequestInit {
  return signal === undefined ? init : { ...init, signal };
}

export function submitQuery(
  payload: QueryRequest,
  signal?: AbortSignal,
): Promise<ApiResult<QueryResponse>> {
  return request(
    "/api/v1/query",
    decodeQueryResponse,
    withSignal({ method: "POST", body: JSON.stringify(payload) }, signal),
  );
}

export function getCacheStats(signal?: AbortSignal): Promise<ApiResult<CacheStatsResponse>> {
  return request(
    "/api/v1/cache/stats",
    decodeCacheStats,
    withSignal({ method: "GET" }, signal),
  );
}

export function clearCache(): Promise<ApiResult<ClearCacheResponse>> {
  return request("/api/v1/cache", decodeClearCache, { method: "DELETE" });
}

export function getCacheThreshold(): Promise<ApiResult<CacheThresholdResponse>> {
  return request("/api/v1/cache/threshold", decodeCacheThreshold, { method: "GET" });
}

export function updateCacheThreshold(
  threshold: number,
): Promise<ApiResult<CacheThresholdResponse>> {
  return request("/api/v1/cache/threshold", decodeCacheThreshold, {
    method: "PUT",
    body: JSON.stringify({ threshold }),
  });
}
