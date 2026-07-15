export interface QueryRequest {
  prompt: string;
}

export interface QueryResponse {
  response: string;
  cache_hit: boolean;
  similarity_score: number | null;
  latency_ms: number;
}

export interface CacheStatsResponse {
  size: number;
  hits: number;
  misses: number;
  hit_rate: number;
}

export interface ClearCacheResponse {
  cleared: true;
}

export interface ApiError {
  code: string;
  detail: string | null;
  status: number | null;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: QueryResponse }
  | { status: "error"; error: ApiError };
