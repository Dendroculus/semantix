import { describe, expect, it } from 'vitest';

import {
  decodeBenchmarkDatasets,
  decodeBenchmarkRun,
} from '@/features/benchmark/api/benchmarkDecoders';
import type { BenchmarkRunResponse } from '@/features/benchmark/types';
import {
  benchmarkDataset,
  benchmarkResult,
} from './support';

interface InvalidRunCase {
  mutate: (value: BenchmarkRunResponse) => void;
  name: string;
}

const INVALID_RUN_CASES: InvalidRunCase[] = [
  {
    name: 'an invalid run ID',
    mutate: (value) => {
      value.run_id = 'not-a-run-id';
    },
  },
  {
    name: 'zero repetitions',
    mutate: (value) => {
      value.repetitions = 0;
    },
  },
  {
    name: 'more than five repetitions',
    mutate: (value) => {
      value.repetitions = 6;
    },
  },
  {
    name: 'fewer than two threshold evaluations',
    mutate: (value) => {
      value.threshold_evaluations = value.threshold_evaluations.slice(0, 1);
    },
  },
  {
    name: 'an empty query-result workload',
    mutate: (value) => {
      value.query_results = [];
    },
  },
  {
    name: 'cache totals that do not cover every query',
    mutate: (value) => {
      value.metrics.cache_misses = 0;
    },
  },
  {
    name: 'provider totals that do not cover every query',
    mutate: (value) => {
      value.metrics.provider_calls_avoided = 0;
    },
  },
  {
    name: 'completion before the start time',
    mutate: (value) => {
      value.completed_at = '2026-07-17T09:59:59Z';
    },
  },
  {
    name: 'a workload/result-count mismatch',
    mutate: (value) => {
      value.dataset.query_count = 3;
      value.dataset.expected_misses = 2;
    },
  },
  {
    name: 'a metrics/result-count mismatch',
    mutate: (value) => {
      value.metrics.total_queries = 3;
      value.metrics.cache_misses = 2;
      value.metrics.provider_calls = 2;
    },
  },
];

describe('benchmark decoders', () => {
  it('accepts a response that satisfies the backend contract', () => {
    expect(decodeBenchmarkRun(structuredClone(benchmarkResult))).toEqual(
      benchmarkResult,
    );
  });

  it.each(INVALID_RUN_CASES)('rejects $name', ({ mutate }) => {
    const value = structuredClone(benchmarkResult);
    mutate(value);

    expect(() => decodeBenchmarkRun(value)).toThrow();
  });

  it('rejects empty dataset names, descriptions, and categories', () => {
    for (const mutate of [
      (value: typeof benchmarkDataset) => {
        value.name = '';
      },
      (value: typeof benchmarkDataset) => {
        value.description = '';
      },
      (value: typeof benchmarkDataset) => {
        value.categories = [];
      },
    ]) {
      const value = structuredClone(benchmarkDataset);
      mutate(value);

      expect(() =>
        decodeBenchmarkDatasets({
          datasets: [value],
          default_dataset_id: value.dataset_id,
        }),
      ).toThrow();
    }
  });

  it('rejects zero or inconsistent dataset accounting', () => {
    const zeroCount = structuredClone(benchmarkDataset);
    zeroCount.query_count = 0;
    zeroCount.expected_hits = 0;
    zeroCount.expected_misses = 0;

    const inconsistent = structuredClone(benchmarkDataset);
    inconsistent.expected_misses = 0;

    for (const value of [zeroCount, inconsistent]) {
      expect(() =>
        decodeBenchmarkDatasets({
          datasets: [value],
          default_dataset_id: value.dataset_id,
        }),
      ).toThrow();
    }
  });

  it('rejects a default dataset that is absent from the response', () => {
    expect(() =>
      decodeBenchmarkDatasets({
        datasets: [benchmarkDataset],
        default_dataset_id: 'extended',
      }),
    ).toThrow();
  });
});
