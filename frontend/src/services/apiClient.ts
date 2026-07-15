import { API_BASE_URL } from "../config/env";
import type {
  ApiError,
  ApiResult,
  CacheStatsResponse,
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

function parseQueryResponse(value: unknown): QueryResponse {
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

function parseCacheStats(value: unknown): CacheStatsResponse {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.size) ||
    !isFiniteNumber(value.hits) ||
    !isFiniteNumber(value.misses) ||
    !isFiniteNumber(value.hit_rate)
  ) {
    throw new Error("Invalid cache statistics response");
  }
  return {
    size: value.size,
    hits: value.hits,
    misses: value.misses,
    hit_rate: value.hit_rate,
  };
}

function parseClearResponse(value: unknown): ClearCacheResponse {
  if (!isRecord(value) || value.cleared !== true) {
    throw new Error("Invalid clear-cache response");
  }
  return { cleared: true };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new Error("Server returned malformed JSON");
    }
    throw error;
  }
}

function parseApiError(value: unknown, status: number): ApiError {
  if (
    isRecord(value) &&
    typeof value.error === "string" &&
    (value.detail === null || typeof value.detail === "string")
  ) {
    return { code: value.error, detail: value.detail, status };
  }
  return {
    code: "invalid_error_response",
    detail: "The server returned an unexpected error response.",
    status,
  };
}

async function request<T>(
  path: string,
  decoder: Decoder<T>,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(API_BASE_URL + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "network_error",
        detail: error instanceof Error ? error.message : "The network request failed.",
        status: null,
      },
    };
  }

  let payload: unknown;
  try {
    payload = await readJson(response);
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        detail: error instanceof Error ? error.message : "The server response could not be read.",
        status: response.status,
      },
    };
  }

  if (!response.ok) {
    return { ok: false, error: parseApiError(payload, response.status) };
  }

  try {
    return { ok: true, data: decoder(payload) };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        detail: error instanceof Error ? error.message : "The server returned an invalid response.",
        status: response.status,
      },
    };
  }
}

function withSignal(init: RequestInit, signal?: AbortSignal): RequestInit {
  if (signal === undefined) {
    return init;
  }
  return { ...init, signal };
}

export function submitQuery(
  payload: QueryRequest,
  signal?: AbortSignal,
): Promise<ApiResult<QueryResponse>> {
  return request(
    "/api/v1/query",
    parseQueryResponse,
    withSignal(
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      signal,
    ),
  );
}

export function getCacheStats(
  signal?: AbortSignal,
): Promise<ApiResult<CacheStatsResponse>> {
  return request(
    "/api/v1/cache/stats",
    parseCacheStats,
    withSignal({ method: "GET" }, signal),
  );
}

export function clearCache(): Promise<ApiResult<ClearCacheResponse>> {
  return request("/api/v1/cache", parseClearResponse, { method: "DELETE" });
}
