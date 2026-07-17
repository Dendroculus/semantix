export interface QueryRequest {
  prompt: string;
}

export interface QueryResponse {
  response: string;
  cache_hit: boolean;
  similarity_score: number | null;
  similarity_threshold: number;
  matched_prompt: string | null;
  matched_cache_key: string | null;
  cache_entry_created_at: string | null;
  cache_entry_age_seconds: number | null;
  generation_skipped: boolean;
  provider_called: boolean;
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

export type CacheEntrySort =
  | "newest"
  | "oldest"
  | "most_hit"
  | "nearest_expiry";

export interface CacheEntryMetadata {
  cache_key: string;
  prompt: string;
  response_preview: string;
  created_at: string;
  expires_at: string | null;
  remaining_ttl_seconds: number | null;
  hit_count: number;
  last_accessed_at: string | null;
  recency_rank: number;
  is_expired: boolean;
}

export interface CacheEntryListResponse {
  items: CacheEntryMetadata[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface CacheEntryListParams {
  offset: number;
  limit: number;
  search: string;
  sort: CacheEntrySort;
}

export interface DeleteCacheEntryResponse {
  deleted: true;
  cache_key: string;
}

export interface CacheThresholdResponse {
  threshold: number;
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
