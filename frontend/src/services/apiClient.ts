import { API_BASE_URL } from '../config/env';
import type {
  ApiError,
  ApiResult,
  CacheStatsResponse,
  ClearCacheResponse,
  QueryRequest,
  QueryResponse,
} from '../types/api';
type Decoder<T> = (value: unknown) => T;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function number(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function query(value: unknown): QueryResponse {
  if (
    !record(value) ||
    typeof value.response !== 'string' ||
    typeof value.cache_hit !== 'boolean' ||
    !number(value.latency_ms) ||
    !(value.similarity_score === null || number(value.similarity_score))
  )
    throw new Error('Invalid query response');
  return {
    response: value.response,
    cache_hit: value.cache_hit,
    similarity_score: value.similarity_score,
    latency_ms: value.latency_ms,
  };
}
function stats(value: unknown): CacheStatsResponse {
  if (
    !record(value) ||
    !number(value.size) ||
    !number(value.hits) ||
    !number(value.misses) ||
    !number(value.hit_rate)
  )
    throw new Error('Invalid stats response');
  return {
    size: value.size,
    hits: value.hits,
    misses: value.misses,
    hit_rate: value.hit_rate,
  };
}
function cleared(value: unknown): ClearCacheResponse {
  if (!record(value) || value.cleared !== true)
    throw new Error('Invalid clear response');
  return { cleared: true };
}
function apiError(value: unknown, status: number): ApiError {
  if (
    record(value) &&
    typeof value.error === 'string' &&
    (value.detail === null || typeof value.detail === 'string')
  )
    return { code: value.error, detail: value.detail, status };
  return {
    code: 'invalid_error_response',
    detail: 'The server returned an unexpected response.',
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
    response = await fetch(API_BASE_URL + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: 'network_error',
        detail:
          error instanceof Error ? error.message : 'Network request failed.',
        status: null,
      },
    };
  }
  let payload: unknown;
  try {
    const text = await response.text();
    payload = text.trim() === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        detail: 'The server returned malformed JSON.',
        status: response.status,
      },
    };
  }
  if (!response.ok)
    return { ok: false, error: apiError(payload, response.status) };
  try {
    return { ok: true, data: decoder(payload) };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        detail: error instanceof Error ? error.message : 'Invalid response.',
        status: response.status,
      },
    };
  }
}
function signal(init: RequestInit, value?: AbortSignal): RequestInit {
  return value === undefined ? init : { ...init, signal: value };
}
export function submitQuery(
  payload: QueryRequest,
  value?: AbortSignal,
): Promise<ApiResult<QueryResponse>> {
  return request(
    '/api/v1/query',
    query,
    signal({ method: 'POST', body: JSON.stringify(payload) }, value),
  );
}
export function getCacheStats(
  value?: AbortSignal,
): Promise<ApiResult<CacheStatsResponse>> {
  return request(
    '/api/v1/cache/stats',
    stats,
    signal({ method: 'GET' }, value),
  );
}
export function clearCache(): Promise<ApiResult<ClearCacheResponse>> {
  return request('/api/v1/cache', cleared, { method: 'DELETE' });
}

export function getCacheThreshold(): Promise<
  ApiResult<CacheThresholdResponse>
> {
  return request('/api/v1/cache/threshold', parseCacheThresholdResponse, {
    method: 'GET',
  });
}

export function updateCacheThreshold(
  threshold: number,
): Promise<ApiResult<CacheThresholdResponse>> {
  return request('/api/v1/cache/threshold', parseCacheThresholdResponse, {
    method: 'PUT',
    body: JSON.stringify({ threshold }),
  });
}
