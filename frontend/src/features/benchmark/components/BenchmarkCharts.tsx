import type { ComponentProps } from 'react';
import {
  formatDecimal,
  formatLatency,
  formatPercent,
} from '@/shared/lib/formatters';
import type {
  BenchmarkRunResponse,
  ThresholdEvaluation,
} from '../types';
import { LineChart } from './LineChart';
import { SimilarityDistribution } from './SimilarityDistribution';

interface BenchmarkChartsProps {
  result: BenchmarkRunResponse;
}

function points(
  evaluations: ThresholdEvaluation[],
  value: (evaluation: ThresholdEvaluation) => number,
): Array<{ x: number; y: number }> {
  return evaluations.map((evaluation) => ({
    x: evaluation.threshold,
    y: value(evaluation),
  }));
}

export function BenchmarkCharts({
  result,
}: Readonly<BenchmarkChartsProps>): JSX.Element {
  const evaluations = result.threshold_evaluations;
  const charts = [
    {
      series: [
        {
          color: 'var(--gold)',
          label: 'Hit rate',
          points: points(evaluations, (item) => item.hit_rate),
        },
      ],
      title: 'Hit rate vs. threshold',
      valueLabel: (value: number) => formatPercent(value, 0),
    },
    {
      series: [
        {
          color: 'var(--teal)',
          label: 'Precision',
          points: points(evaluations, (item) => item.precision),
        },
        {
          color: 'var(--coral)',
          label: 'Recall',
          points: points(evaluations, (item) => item.recall),
        },
      ],
      title: 'Precision / recall vs. threshold',
      valueLabel: (value: number) => formatPercent(value, 0),
    },
    {
      series: [
        {
          color: 'var(--gold)',
          label: 'Estimated average latency',
          points: points(evaluations, (item) => item.average_latency_ms),
        },
      ],
      title: 'Average latency vs. threshold',
      valueLabel: (value: number) => formatLatency(value, 0),
    },
    {
      series: [
        {
          color: 'var(--teal)',
          label: 'Provider calls avoided',
          points: points(
            evaluations,
            (item) => item.provider_calls_avoided,
          ),
        },
      ],
      title: 'Provider calls avoided vs. threshold',
      valueLabel: (value: number) => formatDecimal(value, 0),
    },
  ] satisfies ComponentProps<typeof LineChart>[];

  return (
    <section aria-labelledby="benchmark-charts-heading" className="mt-12">
      <h3
        className="font-display text-2xl italic"
        id="benchmark-charts-heading"
      >
        Threshold evaluation
      </h3>
      <p className="mt-2 max-w-3xl text-sm/6 text-(--text-muted)">
        Threshold series reclassify the measured nearest-match scores. Their
        latency line uses this run’s measured average hit and miss latency as
        an estimate; it does not make additional provider calls.
      </p>
      <div className="mt-7 grid gap-8 md:grid-cols-2">
        {charts.map((chart) => (
          <LineChart key={chart.title} {...chart} />
        ))}
        <SimilarityDistribution results={result.query_results} />
      </div>
    </section>
  );
}
