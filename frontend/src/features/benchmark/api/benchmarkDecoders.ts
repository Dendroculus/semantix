import {
  createEnumGuard,
  isIsoDate,
  isNonEmptyString,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isNullableNonNegativeNumber,
  isNumberInRange,
  isRecord,
} from '@/shared/api/validators';
import { SIMILARITY_MAX, SIMILARITY_MIN } from '@/shared/domain/similarity';
import type {
  BenchmarkDatasetId,
  BenchmarkDatasetListResponse,
  BenchmarkDatasetSummary,
  BenchmarkMetrics,
  BenchmarkOutcome,
  BenchmarkQueryResult,
  BenchmarkReproducibilityMetadata,
  BenchmarkRunResponse,
  EvaluationDatasetPreview,
  EvaluationDatasetWarning,
  EvaluationDatasetSourceKind,
  ProviderCategory,
  ThresholdEvaluation,
} from '../types';

const DATASET_IDS: readonly BenchmarkDatasetId[] = ['quick', 'extended'];

const OUTCOMES: readonly BenchmarkOutcome[] = [
  'true_positive',
  'true_negative',
  'false_positive',
  'false_negative',
];
const PROVIDER_CATEGORIES: readonly ProviderCategory[] = [
  'huggingface',
  'openai',
  'anthropic',
  'gemini',
  'ollama',
  'mock',
];
const RESULT_KINDS = ['measured', 'projected'] as const;
const NORMALIZATION_MODES = ['identity', 'typo_correction'] as const;
const DATASET_SOURCE_KINDS: readonly EvaluationDatasetSourceKind[] = [
  'builtin',
  'inline',
];

const isDatasetId = createEnumGuard(DATASET_IDS);
const isOutcome = createEnumGuard(OUTCOMES);
const isProviderCategory = createEnumGuard(PROVIDER_CATEGORIES);
const isResultKind = createEnumGuard(RESULT_KINDS);
const isNormalizationMode = createEnumGuard(NORMALIZATION_MODES);
const isDatasetSourceKind = createEnumGuard(DATASET_SOURCE_KINDS);
const RUN_ID_PATTERN = /^[a-f0-9]{32}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DATASET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
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
    !isNonEmptyString(value.dataset_id) ||
    value.dataset_id.length > 100 ||
    !DATASET_ID_PATTERN.test(value.dataset_id) ||
    !isDatasetSourceKind(value.dataset_source) ||
    !(
      value.schema_version === null ||
      (isNonNegativeInteger(value.schema_version) && value.schema_version >= 1)
    ) ||
    !isNonEmptyString(value.version) ||
    value.version.length > 50 ||
    typeof value.digest !== 'string' ||
    !SHA256_PATTERN.test(value.digest) ||
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
    !value.categories.every(
      (category) =>
        isNonEmptyString(category) && category.length <= 100,
    )
  ) {
    throw new Error('Invalid benchmark dataset');
  }

  if (
    value.expected_hits + value.expected_misses !== value.query_count ||
    new Set(value.categories).size !== value.categories.length ||
    (value.dataset_source === 'builtin' && value.schema_version !== null) ||
    (value.dataset_source === 'inline' && value.schema_version !== 1)
  ) {
    throw new Error('Invalid benchmark dataset accounting');
  }

  return {
    dataset_id: value.dataset_id,
    dataset_source: value.dataset_source,
    schema_version: value.schema_version,
    version: value.version,
    digest: value.digest,
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
  const truePositiveHits = value.true_positive_hits;
  const trueNegativeMisses = value.true_negative_misses;
  const falsePositiveHits = value.false_positive_hits;
  const falseNegativeMisses = value.false_negative_misses;
  const integers = [
    value.estimated_tokens_saved,
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
    !isNonNegativeInteger(truePositiveHits) ||
    !isNonNegativeInteger(trueNegativeMisses) ||
    !isNonNegativeInteger(falsePositiveHits) ||
    !isNonNegativeInteger(falseNegativeMisses) ||
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
    providerCalls + providerCallsAvoided !== totalQueries ||
    truePositiveHits +
      trueNegativeMisses +
      falsePositiveHits +
      falseNegativeMisses !==
      totalQueries ||
    truePositiveHits + falsePositiveHits !== cacheHits ||
    trueNegativeMisses + falseNegativeMisses !== cacheMisses ||
    providerCalls !== cacheMisses ||
    providerCallsAvoided !== cacheHits
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
  const hasValidMatchedKey =
    value.matched_cache_key === null ||
    (typeof value.matched_cache_key === 'string' &&
      SHA256_PATTERN.test(value.matched_cache_key));

  if (
    !isNonNegativeInteger(value.sequence) ||
    value.sequence < 1 ||
    !isNonNegativeInteger(value.repetition) ||
    value.repetition < 1 ||
    !isNonEmptyString(value.case_id) ||
    value.case_id.length > 100 ||
    !isNonEmptyString(value.category) ||
    value.category.length > 100 ||
    !isNonEmptyString(value.prompt) ||
    value.prompt.length > 2_000 ||
    typeof value.expected_cache_hit !== 'boolean' ||
    !isNullableBoundedString(value.expected_match_case_id, 100) ||
    !isNullableBoundedString(value.note, 500) ||
    typeof value.actual_cache_hit !== 'boolean' ||
    typeof value.correct !== 'boolean' ||
    !isOutcome(value.outcome) ||
    !hasValidSimilarityScore ||
    !isNonNegativeNumber(value.latency_ms) ||
    typeof value.provider_called !== 'boolean' ||
    !isNullableBoundedString(value.matched_prompt, 2_000) ||
    !hasValidMatchedKey
  ) {
    throw new Error('Invalid benchmark query result');
  }

  let expectedOutcome: BenchmarkOutcome;
  if (value.actual_cache_hit) {
    expectedOutcome = value.expected_cache_hit
      ? 'true_positive'
      : 'false_positive';
  } else {
    expectedOutcome = value.expected_cache_hit
      ? 'false_negative'
      : 'true_negative';
  }
  if (
    value.outcome !== expectedOutcome ||
    value.correct !== (value.expected_cache_hit === value.actual_cache_hit) ||
    (!value.expected_cache_hit && value.expected_match_case_id !== null) ||
    value.provider_called === value.actual_cache_hit ||
    (value.actual_cache_hit &&
      (value.matched_prompt === null || value.matched_cache_key === null)) ||
    (!value.actual_cache_hit &&
      (value.matched_prompt !== null || value.matched_cache_key !== null))
  ) {
    throw new Error('Invalid benchmark query accounting');
  }

  return value as unknown as BenchmarkQueryResult;
}

function thresholdEvaluation(value: unknown): ThresholdEvaluation {
  if (
    !isRecord(value) ||
    !isNumberInRange(value.threshold, 0, 1) ||
    !isResultKind(value.result_kind) ||
    !isNumberInRange(value.hit_rate, 0, 1) ||
    !isNumberInRange(value.precision, 0, 1) ||
    !isNumberInRange(value.recall, 0, 1) ||
    !isNumberInRange(value.f1_score, 0, 1) ||
    !isNonNegativeNumber(value.average_latency_ms) ||
    !isNonNegativeInteger(value.provider_calls_avoided) ||
    !isNonNegativeInteger(value.true_positive_hits) ||
    !isNonNegativeInteger(value.true_negative_misses) ||
    !isNonNegativeInteger(value.false_positive_hits) ||
    !isNonNegativeInteger(value.false_negative_misses)
  ) {
    throw new Error('Invalid threshold evaluation');
  }

  if (
    value.true_positive_hits + value.false_positive_hits !==
    value.provider_calls_avoided
  ) {
    throw new Error('Invalid threshold evaluation accounting');
  }

  return value as unknown as ThresholdEvaluation;
}

function reproducibility(
  value: unknown,
): BenchmarkReproducibilityMetadata {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.application_version) ||
    value.application_version.length > 50 ||
    !isNonEmptyString(value.dataset_id) ||
    value.dataset_id.length > 100 ||
    !DATASET_ID_PATTERN.test(value.dataset_id) ||
    !isDatasetSourceKind(value.dataset_source) ||
    !(
      value.dataset_schema_version === null ||
      (isNonNegativeInteger(value.dataset_schema_version) &&
        value.dataset_schema_version >= 1)
    ) ||
    !isNonEmptyString(value.dataset_version) ||
    value.dataset_version.length > 50 ||
    typeof value.dataset_digest !== 'string' ||
    !SHA256_PATTERN.test(value.dataset_digest) ||
    !isProviderCategory(value.embedding_provider_category) ||
    !isProviderCategory(value.generation_provider_category) ||
    !isNonNegativeInteger(value.embedding_dimensions) ||
    value.embedding_dimensions < 1 ||
    typeof value.embedding_space_fingerprint !== 'string' ||
    !SHA256_PATTERN.test(value.embedding_space_fingerprint) ||
    !isNormalizationMode(value.normalization_mode) ||
    typeof value.normalization_fingerprint !== 'string' ||
    !SHA256_PATTERN.test(value.normalization_fingerprint) ||
    !isNumberInRange(value.measured_threshold, 0, 1) ||
    !Array.isArray(value.evaluation_thresholds) ||
    value.evaluation_thresholds.length < 2 ||
    value.evaluation_thresholds.length > 15 ||
    !value.evaluation_thresholds.every((threshold) =>
      isNumberInRange(threshold, 0, 1),
    ) ||
    !isNonNegativeInteger(value.repetitions) ||
    !isNumberInRange(value.repetitions, 1, 5) ||
    typeof value.reset_cache_before_run !== 'boolean' ||
    !isNumberInRange(value.estimated_cost_per_request_usd, 0, 100) ||
    !isNumberInRange(value.estimated_cost_per_1k_tokens_usd, 0, 100) ||
    !isNonNegativeNumber(value.evaluation_timeout_seconds) ||
    value.evaluation_timeout_seconds <= 0 ||
    value.evaluation_timeout_seconds > 3_600 ||
    typeof value.configuration_fingerprint !== 'string' ||
    !SHA256_PATTERN.test(value.configuration_fingerprint)
  ) {
    throw new Error('Invalid benchmark reproducibility metadata');
  }

  const thresholds = value.evaluation_thresholds as number[];
  if (
    (value.dataset_source === 'builtin' &&
      value.dataset_schema_version !== null) ||
    (value.dataset_source === 'inline' &&
      value.dataset_schema_version !== 1) ||
    thresholds.some(
      (threshold, index) =>
        index > 0 &&
        threshold <= (thresholds[index - 1] ?? threshold),
    )
  ) {
    throw new Error('Invalid benchmark reproducibility thresholds');
  }

  return value as unknown as BenchmarkReproducibilityMetadata;
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

function isNullableBoundedString(
  value: unknown,
  maximumLength: number,
): value is string | null {
  return (
    value === null ||
    (isNonEmptyString(value) && value.length <= maximumLength)
  );
}

function warning(value: unknown): EvaluationDatasetWarning {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.code) ||
    value.code.length > 100 ||
    !isNonEmptyString(value.detail) ||
    value.detail.length > 300 ||
    !isNonNegativeInteger(value.count) ||
    value.count < 1
  ) {
    throw new Error('Invalid evaluation dataset warning');
  }
  return value as unknown as EvaluationDatasetWarning;
}

export function decodeEvaluationDatasetPreview(
  value: unknown,
): EvaluationDatasetPreview {
  if (
    !isRecord(value) ||
    value.schema_version !== 1 ||
    !isNonEmptyString(value.dataset_id) ||
    value.dataset_id.length > 100 ||
    !DATASET_ID_PATTERN.test(value.dataset_id) ||
    typeof value.digest !== 'string' ||
    !SHA256_PATTERN.test(value.digest) ||
    !isNonEmptyString(value.name) ||
    value.name.length > 100 ||
    !isNullableBoundedString(value.description, 300) ||
    !isNonNegativeInteger(value.case_count) ||
    value.case_count < 1 ||
    !isNonNegativeInteger(value.expected_hits) ||
    !isNonNegativeInteger(value.expected_misses) ||
    value.expected_hits + value.expected_misses !== value.case_count ||
    !Array.isArray(value.categories) ||
    value.categories.length === 0 ||
    !value.categories.every(
      (category) =>
        isNonEmptyString(category) && category.length <= 100,
    ) ||
    !isNonNegativeInteger(value.decoded_bytes) ||
    value.decoded_bytes < 1 ||
    !Array.isArray(value.warnings) ||
    !isNonNegativeInteger(value.query_executions) ||
    value.query_executions < 1 ||
    !isNonNegativeInteger(value.threshold_projection_evaluations) ||
    value.threshold_projection_evaluations < 2 ||
    !isNonNegativeInteger(value.maximum_provider_calls) ||
    value.maximum_provider_calls < 1 ||
    value.provider_calls_made !== 0 ||
    !isRecord(value.limits) ||
    !isNonNegativeInteger(value.limits.max_cases) ||
    value.limits.max_cases < 1 ||
    !isNonNegativeInteger(value.limits.max_decoded_bytes) ||
    value.limits.max_decoded_bytes < 1 ||
    !isNonNegativeInteger(value.limits.max_workload_queries) ||
    value.limits.max_workload_queries < 1
  ) {
    throw new Error('Invalid evaluation dataset preview');
  }

  const warnings = value.warnings.map(warning);
  if (
    new Set(value.categories).size !== value.categories.length ||
    value.query_executions > value.limits.max_workload_queries ||
    value.case_count > value.limits.max_cases ||
    value.decoded_bytes > value.limits.max_decoded_bytes ||
    value.maximum_provider_calls !== value.query_executions
  ) {
    throw new Error('Invalid evaluation dataset preview accounting');
  }

  return {
    ...value,
    warnings,
  } as unknown as EvaluationDatasetPreview;
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
    !isRecord(value.reproducibility) ||
    value.threshold_evaluation_mode !== 'frozen_candidate_projection' ||
    !Array.isArray(value.threshold_evaluations) ||
    value.threshold_evaluations.length < 2 ||
    value.threshold_evaluations.length > 15 ||
    !Array.isArray(value.query_results) ||
    value.query_results.length === 0
  ) {
    throw new Error('Invalid benchmark run response');
  }

  const decodedDataset = dataset(value.dataset);
  const decodedReproducibility = reproducibility(value.reproducibility);
  const decodedMetrics = metrics(value.metrics);
  const thresholdEvaluations =
    value.threshold_evaluations.map(thresholdEvaluation);
  const queryResults = value.query_results.map(queryResult);
  const expectedResultCount =
    decodedDataset.query_count * value.repetitions;
  const thresholds = thresholdEvaluations.map(
    (evaluation) => evaluation.threshold,
  );
  const measured = thresholdEvaluations.filter(
    (evaluation) => evaluation.result_kind === 'measured',
  );
  const outcomeCount = (outcome: BenchmarkOutcome): number =>
    queryResults.filter((query) => query.outcome === outcome).length;

  if (
    Date.parse(value.completed_at) < Date.parse(value.started_at) ||
    queryResults.length !== expectedResultCount ||
    decodedMetrics.total_queries !== queryResults.length ||
    decodedMetrics.true_positive_hits !== outcomeCount('true_positive') ||
    decodedMetrics.true_negative_misses !== outcomeCount('true_negative') ||
    decodedMetrics.false_positive_hits !== outcomeCount('false_positive') ||
    decodedMetrics.false_negative_misses !== outcomeCount('false_negative') ||
    decodedMetrics.provider_calls !==
      queryResults.filter((query) => query.provider_called).length ||
    measured.length !== 1 ||
    measured[0]?.threshold !== value.threshold ||
    thresholds.some(
      (threshold, index) =>
        index > 0 && threshold <= (thresholds[index - 1] ?? threshold),
    ) ||
    thresholdEvaluations.some(
      (evaluation) =>
        evaluation.true_positive_hits +
          evaluation.true_negative_misses +
          evaluation.false_positive_hits +
          evaluation.false_negative_misses !==
        queryResults.length,
    ) ||
    decodedReproducibility.dataset_id !== decodedDataset.dataset_id ||
    decodedReproducibility.dataset_source !==
      decodedDataset.dataset_source ||
    decodedReproducibility.dataset_schema_version !==
      decodedDataset.schema_version ||
    decodedReproducibility.dataset_version !== decodedDataset.version ||
    decodedReproducibility.dataset_digest !== decodedDataset.digest ||
    decodedReproducibility.measured_threshold !== value.threshold ||
    decodedReproducibility.repetitions !== value.repetitions ||
    decodedReproducibility.reset_cache_before_run !==
      value.reset_cache_before_run ||
    decodedReproducibility.estimated_cost_per_request_usd !==
      value.estimated_cost_per_request_usd ||
    decodedReproducibility.estimated_cost_per_1k_tokens_usd !==
      value.estimated_cost_per_1k_tokens_usd ||
    decodedReproducibility.evaluation_thresholds.length !== thresholds.length ||
    decodedReproducibility.evaluation_thresholds.some(
      (threshold, index) => threshold !== thresholds[index],
    )
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
    reproducibility: decodedReproducibility,
    metrics: decodedMetrics,
    threshold_evaluation_mode: value.threshold_evaluation_mode,
    threshold_evaluations: thresholdEvaluations,
    query_results: queryResults,
  };
}
