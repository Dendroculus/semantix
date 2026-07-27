import {
  createEnumGuard,
  isIsoDate,
  isNonEmptyString,
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
const RUN_ID_PATTERN = /^[a-f0-9]{32}$/;
const TIMEZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;

function isTimezoneAwareIsoDate(value: unknown): value is string {
  return (
    isIsoDate(value) &&
    TIMEZONE_SUFFIX_PATTERN.test(value)
  );
}

function dataset(value: unknown): BenchmarkDatasetSummary {
  if (
    !isRecord(value) ||
    !isDatasetId(value.dataset_id) ||
    !isNonEmptyString(value.name) ||
    value.name.length > 100 ||
    !isNonEmptyString(value.description) ||
    value.description.length > 300 ||
    !isNonNegativeInteger(value.query_count) ||
    value.query_count < 1 ||
    !isNonNegativeInteger(value.expected_hits) ||
    !isNonNegativeInteger(value.expected_misses) ||
    !Array.isArray(value.categories) ||
    value.categories.length === 0 ||
    !value.categories.every(isCategory)
  ) {
    throw new Error('Invalid benchmark dataset');
  }

  if (value.expected_hits + value.expected_misses !== value.query_count) {
    throw new Error('Invalid benchmark dataset accounting');
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

  const totalQueries = value.total_queries;
  const cacheHits = value.cache_hits;
  const cacheMisses = value.cache_misses;
  const providerCalls = value.provider_calls;
  const providerCallsAvoided = value.provider_calls_avoided;
  const integers = [
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
    !isNonNegativeInteger(totalQueries) ||
    !isNonNegativeInteger(cacheHits) ||
    !isNonNegativeInteger(cacheMisses) ||
    !isNonNegativeInteger(providerCalls) ||
    !isNonNegativeInteger(providerCallsAvoided) ||
    !integers.every(isNonNegativeInteger) ||
    totalQueries < 1 ||
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

  if (
    cacheHits + cacheMisses !== totalQueries ||
    providerCalls + providerCallsAvoided !== totalQueries
  ) {
    throw new Error('Invalid benchmark metric accounting');
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
    value.sequence < 1 ||
    !isNonNegativeInteger(value.repetition) ||
    value.repetition < 1 ||
    !isNonEmptyString(value.case_id) ||
    value.case_id.length > 100 ||
    !isCategory(value.category) ||
    !isNonEmptyString(value.prompt) ||
    value.prompt.length > 2_000 ||
    typeof value.expected_cache_hit !== 'boolean' ||
    typeof value.actual_cache_hit !== 'boolean' ||
    typeof value.correct !== 'boolean' ||
    !isOutcome(value.outcome) ||
    !hasValidSimilarityScore ||
    !isNonNegativeNumber(value.latency_ms) ||
    typeof value.provider_called !== 'boolean' ||
    !isNullableString(value.matched_prompt) ||
    (value.matched_prompt !== null &&
      (value.matched_prompt.length === 0 ||
        value.matched_prompt.length > 2_000))
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

  const datasets = value.datasets.map(dataset);
  if (
    !datasets.some(
      (item) => item.dataset_id === value.default_dataset_id,
    )
  ) {
    throw new Error('Invalid default benchmark dataset');
  }

  return { datasets, default_dataset_id: value.default_dataset_id };
}

export function decodeBenchmarkRun(value: unknown): BenchmarkRunResponse {
  if (
    !isRecord(value) ||
    typeof value.run_id !== 'string' ||
    !RUN_ID_PATTERN.test(value.run_id) ||
    !isTimezoneAwareIsoDate(value.started_at) ||
    !isTimezoneAwareIsoDate(value.completed_at) ||
    !isNumberInRange(value.threshold, 0, 1) ||
    !isNonNegativeInteger(value.repetitions) ||
    !isNumberInRange(value.repetitions, 1, 5) ||
    typeof value.reset_cache_before_run !== 'boolean' ||
    !isNonNegativeNumber(value.estimated_cost_per_request_usd) ||
    !isNonNegativeNumber(value.estimated_cost_per_1k_tokens_usd) ||
    value.threshold_evaluation_mode !== 'frozen_candidate_projection' ||
    !Array.isArray(value.threshold_evaluations) ||
    value.threshold_evaluations.length < 2 ||
    !Array.isArray(value.query_results) ||
    value.query_results.length === 0
  ) {
    throw new Error('Invalid benchmark run response');
  }

  const decodedDataset = dataset(value.dataset);
  const decodedMetrics = metrics(value.metrics);
  const thresholdEvaluations =
    value.threshold_evaluations.map(thresholdEvaluation);
  const queryResults = value.query_results.map(queryResult);
  const expectedResultCount =
    decodedDataset.query_count * value.repetitions;

  if (
    Date.parse(value.completed_at) < Date.parse(value.started_at) ||
    queryResults.length !== expectedResultCount ||
    decodedMetrics.total_queries !== queryResults.length
  ) {
    throw new Error('Invalid benchmark run accounting');
  }

  return {
    run_id: value.run_id,
    started_at: value.started_at,
    completed_at: value.completed_at,
    dataset: decodedDataset,
    threshold: value.threshold,
    repetitions: value.repetitions,
    reset_cache_before_run: value.reset_cache_before_run,
    estimated_cost_per_request_usd: value.estimated_cost_per_request_usd,
    estimated_cost_per_1k_tokens_usd: value.estimated_cost_per_1k_tokens_usd,
    metrics: decodedMetrics,
    threshold_evaluation_mode: value.threshold_evaluation_mode,
    threshold_evaluations: thresholdEvaluations,
    query_results: queryResults,
  };
}
