import type {
  CacheEntryListParams,
  CacheEntryListResponse,
  CacheEntryMetadata,
  CacheStatsResponse,
  CacheThresholdResponse,
  ClearCacheResponse,
  DeleteCacheEntryResponse,
} from "../types";
import type { ApiResult } from "@/shared/api/types";
import { request, withSignal } from "@/shared/api/httpClient";
import { isCacheNamespace } from "../namespace";
import {
  isFiniteNumber,
  isIsoDate,
  isNonNegativeInteger,
  isNullableFiniteNumber,
  isNullableString,
  isRecord,
} from "@/shared/api/validators";

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
    typeof value.namespace !== "string" ||
    !isCacheNamespace(value.namespace) ||
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
    value.last_accessed_at === null ||
    isIsoDate(value.last_accessed_at);

  if (!hasValidExpiry || !hasValidLastAccess) {
    throw new Error("Invalid cache-entry timestamps");
  }

  return {
    cache_key: value.cache_key,
    namespace: value.namespace,
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

function decodeCacheEntryList(
  value: unknown,
): CacheEntryListResponse {
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
  const expectedHasMore =
    value.offset + items.length < value.total;

  if (
    items.length > value.limit ||
    value.has_more !== expectedHasMore
  ) {
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

function decodeDeleteCacheEntry(
  value: unknown,
): DeleteCacheEntryResponse {
  if (
    !isRecord(value) ||
    value.deleted !== true ||
    typeof value.cache_key !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.cache_key)
  ) {
    throw new Error("Invalid delete-cache-entry response");
  }

  return {
    deleted: true,
    cache_key: value.cache_key,
  };
}

function decodeCacheThreshold(
  value: unknown,
): CacheThresholdResponse {
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

export function getCacheStats(
  signal?: AbortSignal,
): Promise<ApiResult<CacheStatsResponse>> {
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
  const namespace = params.namespace.trim();
  const search = params.search.trim();
  if (namespace !== "") {
    query.set("namespace", namespace);
  }
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

export function clearCache(namespace?: string): Promise<
  ApiResult<ClearCacheResponse>
> {
  const query = new URLSearchParams();
  if (namespace !== undefined) {
    query.set("namespace", namespace);
  }
  const suffix = query.size === 0 ? "" : `?${query.toString()}`;

  return request(
    `/api/v1/cache${suffix}`,
    decodeClearCache,
    { method: "DELETE" },
  );
}

export function getCacheThreshold(): Promise<
  ApiResult<CacheThresholdResponse>
> {
  return request(
    "/api/v1/cache/threshold",
    decodeCacheThreshold,
    { method: "GET" },
  );
}

export function updateCacheThreshold(
  threshold: number,
): Promise<ApiResult<CacheThresholdResponse>> {
  return request(
    "/api/v1/cache/threshold",
    decodeCacheThreshold,
    {
      method: "PUT",
      body: JSON.stringify({ threshold }),
    },
  );
}
