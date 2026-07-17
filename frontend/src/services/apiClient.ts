import { API_BASE_URL } from "../config/env";
import type {
  ApiError,
  ApiResult,
  CacheEntryListParams,
  CacheEntryListResponse,
  CacheEntryMetadata,
  CacheStatsResponse,
  CacheThresholdResponse,
  ClearCacheResponse,
  DeleteCacheEntryResponse,
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

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function decodeQueryResponse(value: unknown): QueryResponse {
  if (
    !isRecord(value) ||
    typeof value.response !== "string" ||
    typeof value.cache_hit !== "boolean" ||
    !isFiniteNumber(value.similarity_threshold) ||
    value.similarity_threshold < 0 ||
    value.similarity_threshold > 1 ||
    !isNullableString(value.matched_prompt) ||
    !isNullableString(value.matched_cache_key) ||
    !isNullableString(value.cache_entry_created_at) ||
    !isNullableFiniteNumber(value.cache_entry_age_seconds) ||
    typeof value.generation_skipped !== "boolean" ||
    typeof value.provider_called !== "boolean" ||
    !isFiniteNumber(value.latency_ms) ||
    !isNullableFiniteNumber(value.similarity_score)
  ) {
    throw new Error("Invalid query response");
  }

  const hasValidMatchMetadata =
    value.cache_hit
      ? value.similarity_score !== null &&
        value.similarity_score >= value.similarity_threshold &&
        value.matched_prompt !== null &&
        value.matched_prompt.length > 0 &&
        value.matched_cache_key !== null &&
        /^[a-f0-9]{64}$/.test(value.matched_cache_key) &&
        value.cache_entry_created_at !== null &&
        !Number.isNaN(Date.parse(value.cache_entry_created_at)) &&
        value.cache_entry_age_seconds !== null &&
        value.cache_entry_age_seconds >= 0 &&
        value.generation_skipped &&
        !value.provider_called
      : value.matched_prompt === null &&
        value.matched_cache_key === null &&
        value.cache_entry_created_at === null &&
        value.cache_entry_age_seconds === null &&
        !value.generation_skipped &&
        value.provider_called;

  if (
    !hasValidMatchMetadata ||
    value.latency_ms < 0 ||
    (value.similarity_score !== null &&
      (value.similarity_score < -1 || value.similarity_score > 1))
  ) {
    throw new Error("Invalid query explainability metadata");
  }

  return {
    response: value.response,
    cache_hit: value.cache_hit,
    similarity_score: value.similarity_score,
    similarity_threshold: value.similarity_threshold,
    matched_prompt: value.matched_prompt,
    matched_cache_key: value.matched_cache_key,
    cache_entry_created_at: value.cache_entry_created_at,
    cache_entry_age_seconds: value.cache_entry_age_seconds,
    generation_skipped: value.generation_skipped,
    provider_called: value.provider_called,
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

function decodeCacheEntry(value: unknown): CacheEntryMetadata {
  if (
    !isRecord(value) ||
    typeof value.cache_key !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.cache_key) ||
    typeof value.prompt !== "string" ||
    value.prompt.length === 0 ||
    typeof value.response_preview !== "string" ||
    value.response_preview.length === 0 ||
    typeof value.created_at !== "string" ||
    !isIsoDate(value.created_at) ||
    !isNullableString(value.expires_at) ||
    !isNullableFiniteNumber(value.remaining_ttl_seconds) ||
    !isNonNegativeInteger(value.hit_count) ||
    !isNullableString(value.last_accessed_at) ||
    !isNonNegativeInteger(value.recency_rank) ||
    value.recency_rank < 1 ||
    typeof value.is_expired !== "boolean"
  ) {
    throw new Error("Invalid cache-entry metadata");
  }

  const hasValidExpiry =
    value.expires_at === null
      ? value.remaining_ttl_seconds === null
      : isIsoDate(value.expires_at) &&
        value.remaining_ttl_seconds !== null &&
        value.remaining_ttl_seconds >= 0;
  const hasValidLastAccess =
    value.last_accessed_at === null || isIsoDate(value.last_accessed_at);

  if (!hasValidExpiry || !hasValidLastAccess) {
    throw new Error("Invalid cache-entry timestamps");
  }

  return {
    cache_key: value.cache_key,
    prompt: value.prompt,
    response_preview: value.response_preview,
    created_at: value.created_at,
    expires_at: value.expires_at,
    remaining_ttl_seconds: value.remaining_ttl_seconds,
    hit_count: value.hit_count,
    last_accessed_at: value.last_accessed_at,
    recency_rank: value.recency_rank,
    is_expired: value.is_expired,
  };
}

function decodeCacheEntryList(value: unknown): CacheEntryListResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isNonNegativeInteger(value.total) ||
    !isNonNegativeInteger(value.offset) ||
    !isNonNegativeInteger(value.limit) ||
    value.limit < 1 ||
    value.limit > 100 ||
    typeof value.has_more !== "boolean"
  ) {
    throw new Error("Invalid cache-entry list");
  }

  const items = value.items.map(decodeCacheEntry);
  const expectedHasMore = value.offset + items.length < value.total;

  if (items.length > value.limit || value.has_more !== expectedHasMore) {
    throw new Error("Invalid cache-entry page");
  }

  return {
    items,
    total: value.total,
    offset: value.offset,
    limit: value.limit,
    has_more: value.has_more,
  };
}

function decodeClearCache(value: unknown): ClearCacheResponse {
  if (!isRecord(value) || value.cleared !== true) {
    throw new Error("Invalid clear-cache response");
  }

  return { cleared: true };
}

function decodeDeleteCacheEntry(value: unknown): DeleteCacheEntryResponse {
  if (
    !isRecord(value) ||
    value.deleted !== true ||
    typeof value.cache_key !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.cache_key)
  ) {
    throw new Error("Invalid delete-cache-entry response");
  }

  return { deleted: true, cache_key: value.cache_key };
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

export function listCacheEntries(
  params: CacheEntryListParams,
  signal?: AbortSignal,
): Promise<ApiResult<CacheEntryListResponse>> {
  const query = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
    sort: params.sort,
  });
  const search = params.search.trim();
  if (search !== "") {
    query.set("search", search);
  }

  return request(
    `/api/v1/cache/entries?${query.toString()}`,
    decodeCacheEntryList,
    withSignal({ method: "GET" }, signal),
  );
}

export function getCacheEntry(
  cacheKey: string,
  signal?: AbortSignal,
): Promise<ApiResult<CacheEntryMetadata>> {
  return request(
    `/api/v1/cache/entries/${encodeURIComponent(cacheKey)}`,
    decodeCacheEntry,
    withSignal({ method: "GET" }, signal),
  );
}

export function deleteCacheEntry(
  cacheKey: string,
): Promise<ApiResult<DeleteCacheEntryResponse>> {
  return request(
    `/api/v1/cache/entries/${encodeURIComponent(cacheKey)}`,
    decodeDeleteCacheEntry,
    { method: "DELETE" },
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
