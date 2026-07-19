export interface RuntimeMetrics {
  observed_at: string;
  uptime_seconds: number;
  request_count: number;
  error_count: number;
  cache_hits: number;
  cache_misses: number;
  provider_calls: number;
  in_flight_coalesced_requests: number;
  average_latency_ms: number | null;
  p95_latency_ms: number | null;
  latency_sample_size: number;
  cache_size: number;
  evictions: number;
  expirations: number;
}
