import type { ApiError } from "@/shared/api/types";

export interface QueryRequest {
  prompt: string;
  namespace?: string;
  cache_enabled?: boolean;
  cache_read_enabled?: boolean;
  cache_write_enabled?: boolean;
  private?: boolean;
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

export type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: QueryResponse }
  | { status: "error"; error: ApiError };

export interface QueryTrace {
  id: string;
  prompt: string;
  similarity: number | null;
  latencyMs: number;
  recordedAt: Date;
  actualCacheHit: boolean;
  providerCalled: boolean;
}
