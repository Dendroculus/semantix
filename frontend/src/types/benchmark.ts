export type BenchmarkDatasetId = "quick" | "extended";

export type BenchmarkCategory =
  | "seed"
  | "exact_duplicate"
  | "paraphrase"
  | "unrelated"
  | "typo"
  | "negation"
  | "different_intent";

export type BenchmarkOutcome =
  | "true_positive"
  | "true_negative"
  | "false_positive"
  | "false_negative";

export interface BenchmarkDatasetSummary {
  dataset_id: BenchmarkDatasetId;
  name: string;
  description: string;
  query_count: number;
  expected_hits: number;
  expected_misses: number;
  categories: BenchmarkCategory[];
}

export interface BenchmarkDatasetListResponse {
  datasets: BenchmarkDatasetSummary[];
  default_dataset_id: BenchmarkDatasetId;
}

export interface BenchmarkRunRequest {
  dataset_id: BenchmarkDatasetId;
  threshold: number;
  evaluation_thresholds: number[];
  repetitions: number;
  reset_cache_before_run: boolean;
  estimated_cost_per_request_usd: number;
  estimated_cost_per_1k_tokens_usd: number;
  allow_external_provider_calls: true;
}

export interface BenchmarkMetrics {
  total_queries: number;
  cache_hits: number;
  cache_misses: number;
  provider_calls: number;
  provider_calls_avoided: number;
  hit_rate: number;
  average_latency_ms: number;
  median_latency_ms: number;
  p95_latency_ms: number;
  average_cache_hit_latency_ms: number | null;
  average_cache_miss_latency_ms: number | null;
  estimated_latency_saved_ms: number;
  estimated_provider_cost_saved_usd: number;
  estimated_tokens_saved: number;
  false_positive_hits: number;
  false_negative_misses: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface BenchmarkQueryResult {
  sequence: number;
  repetition: number;
  case_id: string;
  category: BenchmarkCategory;
  prompt: string;
  expected_cache_hit: boolean;
  actual_cache_hit: boolean;
  correct: boolean;
  outcome: BenchmarkOutcome;
  similarity_score: number | null;
  latency_ms: number;
  provider_called: boolean;
  matched_prompt: string | null;
}

export interface ThresholdEvaluation {
  threshold: number;
  hit_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  average_latency_ms: number;
  provider_calls_avoided: number;
  false_positive_hits: number;
  false_negative_misses: number;
}

export interface BenchmarkRunResponse {
  run_id: string;
  started_at: string;
  completed_at: string;
  dataset: BenchmarkDatasetSummary;
  threshold: number;
  repetitions: number;
  reset_cache_before_run: boolean;
  estimated_cost_per_request_usd: number;
  estimated_cost_per_1k_tokens_usd: number;
  metrics: BenchmarkMetrics;
  threshold_evaluations: ThresholdEvaluation[];
  query_results: BenchmarkQueryResult[];
}
