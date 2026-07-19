import {
  createEnumGuard,
  isIsoDate,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isNullableNonNegativeNumber,
  isNullableString,
  isNumberInRange,
  isRecord,
} from '@/shared/api/validators';
import { SIMILARITY_MAX, SIMILARITY_MIN } from '@/shared/domain/similarity';
import type {
  BenchmarkCategory,
  BenchmarkDatasetId,
  BenchmarkDatasetListResponse,
  BenchmarkDatasetSummary,
  BenchmarkMetrics,
  BenchmarkOutcome,
  BenchmarkQueryResult,
  BenchmarkRunResponse,
  ThresholdEvaluation,
} from '../types';

const DATASET_IDS: readonly BenchmarkDatasetId[] = ['quick', 'extended'];

const CATEGORIES: readonly BenchmarkCategory[] = [
  'seed',
  'exact_duplicate',
  'paraphrase',
  'unrelated',
  'typo',
  'negation',
  'different_intent',
];

const OUTCOMES: readonly BenchmarkOutcome[] = [
  'true_positive',
  'true_negative',
  'false_positive',
  'false_negative',
];

const isDatasetId = createEnumGuard(DATASET_IDS);
const isCategory = createEnumGuard(CATEGORIES);
const isOutcome = createEnumGuard(OUTCOMES);

function dataset(value: unknown): BenchmarkDatasetSummary {
  if (
    !isRecord(value) ||
    !isDatasetId(value.dataset_id) ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    !isNonNegativeInteger(value.query_count) ||
    !isNonNegativeInteger(value.expected_hits) ||
    !isNonNegativeInteger(value.expected_misses) ||
    !Array.isArray(value.categories) ||
    !value.categories.every(isCategory)
  ) {
    throw new Error('Invalid benchmark dataset');
  }

  return {
    dataset_id: value.dataset_id,
    name: value.name,
    description: value.description,
    query_count: value.query_count,
    expected_hits: value.expected_hits,
    expected_misses: value.expected_misses,
    categories: value.categories,
  };
}

function metrics(value: unknown): BenchmarkMetrics {
  if (!isRecord(value)) {
    throw new Error('Invalid benchmark metrics');
  }

  const integers = [
    value.total_queries,
    value.cache_hits,
    value.cache_misses,
    value.provider_calls,
    value.provider_calls_avoided,
    value.estimated_tokens_saved,
    value.false_positive_hits,
    value.false_negative_misses,
  ];

  const nonNegativeNumbers = [
    value.average_latency_ms,
    value.median_latency_ms,
    value.p95_latency_ms,
    value.estimated_latency_saved_ms,
    value.estimated_provider_cost_saved_usd,
  ];

  if (
    !integers.every(isNonNegativeInteger) ||
    !nonNegativeNumbers.every(isNonNegativeNumber) ||
    !isNumberInRange(value.hit_rate, 0, 1) ||
    !isNumberInRange(value.precision, 0, 1) ||
    !isNumberInRange(value.recall, 0, 1) ||
    !isNumberInRange(value.f1_score, 0, 1) ||
    !isNullableNonNegativeNumber(value.average_cache_hit_latency_ms) ||
    !isNullableNonNegativeNumber(value.average_cache_miss_latency_ms)
  ) {
    throw new Error('Invalid benchmark metrics');
  }

  return value as unknown as BenchmarkMetrics;
}

function queryResult(value: unknown): BenchmarkQueryResult {
  if (!isRecord(value)) {
    throw new Error('Invalid benchmark query result');
  }

  const hasValidSimilarityScore =
    value.similarity_score === null ||
    isNumberInRange(value.similarity_score, SIMILARITY_MIN, SIMILARITY_MAX);

  if (
    !isNonNegativeInteger(value.sequence) ||
    !isNonNegativeInteger(value.repetition) ||
    typeof value.case_id !== 'string' ||
    !isCategory(value.category) ||
    typeof value.prompt !== 'string' ||
    typeof value.expected_cache_hit !== 'boolean' ||
    typeof value.actual_cache_hit !== 'boolean' ||
    typeof value.correct !== 'boolean' ||
    !isOutcome(value.outcome) ||
    !hasValidSimilarityScore ||
    !isNonNegativeNumber(value.latency_ms) ||
    typeof value.provider_called !== 'boolean' ||
    !isNullableString(value.matched_prompt)
  ) {
    throw new Error('Invalid benchmark query result');
  }

  return value as unknown as BenchmarkQueryResult;
}

function thresholdEvaluation(value: unknown): ThresholdEvaluation {
  if (
    !isRecord(value) ||
    !isNumberInRange(value.threshold, 0, 1) ||
    !isNumberInRange(value.hit_rate, 0, 1) ||
    !isNumberInRange(value.precision, 0, 1) ||
    !isNumberInRange(value.recall, 0, 1) ||
    !isNumberInRange(value.f1_score, 0, 1) ||
    !isNonNegativeNumber(value.average_latency_ms) ||
    !isNonNegativeInteger(value.provider_calls_avoided) ||
    !isNonNegativeInteger(value.false_positive_hits) ||
    !isNonNegativeInteger(value.false_negative_misses)
  ) {
    throw new Error('Invalid threshold evaluation');
  }

  return value as unknown as ThresholdEvaluation;
}

export function decodeBenchmarkDatasets(
  value: unknown,
): BenchmarkDatasetListResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.datasets) ||
    value.datasets.length === 0 ||
    !isDatasetId(value.default_dataset_id)
  ) {
    throw new Error('Invalid benchmark dataset response');
  }

  return {
    datasets: value.datasets.map(dataset),
    default_dataset_id: value.default_dataset_id,
  };
}

export function decodeBenchmarkRun(value: unknown): BenchmarkRunResponse {
  if (
    !isRecord(value) ||
    typeof value.run_id !== 'string' ||
    !isIsoDate(value.started_at) ||
    !isIsoDate(value.completed_at) ||
    !isNumberInRange(value.threshold, 0, 1) ||
    !isNonNegativeInteger(value.repetitions) ||
    typeof value.reset_cache_before_run !== 'boolean' ||
    !isNonNegativeNumber(value.estimated_cost_per_request_usd) ||
    !isNonNegativeNumber(value.estimated_cost_per_1k_tokens_usd) ||
    !Array.isArray(value.threshold_evaluations) ||
    !Array.isArray(value.query_results)
  ) {
    throw new Error('Invalid benchmark run response');
  }

  return {
    run_id: value.run_id,
    started_at: value.started_at,
    completed_at: value.completed_at,
    dataset: dataset(value.dataset),
    threshold: value.threshold,
    repetitions: value.repetitions,
    reset_cache_before_run: value.reset_cache_before_run,
    estimated_cost_per_request_usd: value.estimated_cost_per_request_usd,
    estimated_cost_per_1k_tokens_usd: value.estimated_cost_per_1k_tokens_usd,
    metrics: metrics(value.metrics),
    threshold_evaluations: value.threshold_evaluations.map(thresholdEvaluation),
    query_results: value.query_results.map(queryResult),
  };
}
