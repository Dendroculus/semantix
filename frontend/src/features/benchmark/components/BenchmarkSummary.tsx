import {
  formatCount,
  formatDecimal,
  formatLatency,
  formatPercent,
  formatUsd,
} from '@/shared/lib/formatters';
import type { BenchmarkRunResponse } from '../types';

interface BenchmarkSummaryProps {
  result: BenchmarkRunResponse;
}

interface MetricProps {
  label: string;
  tone?: 'gold' | 'teal' | 'coral';
  value: string;
}

const TONE_CLASS: Record<NonNullable<MetricProps['tone']>, string> = {
  gold: 'text-(--gold)',
  teal: 'text-(--teal)',
  coral: 'text-(--coral)',
};

function Metric({ label, tone, value }: Readonly<MetricProps>): JSX.Element {
  const valueClass = tone === undefined ? 'text-(--text)' : TONE_CLASS[tone];

  return (
    <div className="border-t border-(--hairline) pt-3">
      <dt className="ui-label text-(--text-faint)">{label}</dt>
      <dd className={`font-data mt-2 text-lg tabular-nums ${valueClass}`}>
        {value}
      </dd>
    </div>
  );
}

export function BenchmarkSummary({
  result,
}: Readonly<BenchmarkSummaryProps>): JSX.Element {
  const { metrics } = result;
  const metricItems = [
    {
      label: 'Total queries',
      value: formatCount(metrics.total_queries),
    },
    {
      label: 'Cache hit rate',
      tone: 'gold',
      value: formatPercent(metrics.hit_rate),
    },
    {
      label: 'Provider calls',
      tone: 'coral',
      value: formatCount(metrics.provider_calls),
    },
    {
      label: 'Calls avoided',
      tone: 'teal',
      value: formatCount(metrics.provider_calls_avoided),
    },
    {
      label: 'Average latency',
      value: formatLatency(metrics.average_latency_ms),
    },
    {
      label: 'Median latency',
      value: formatLatency(metrics.median_latency_ms),
    },
    {
      label: 'P95 latency',
      value: formatLatency(metrics.p95_latency_ms),
    },
    {
      label: 'Hit / miss latency',
      value: `${formatLatency(
        metrics.average_cache_hit_latency_ms,
      )} / ${formatLatency(metrics.average_cache_miss_latency_ms)}`,
    },
    {
      label: 'Precision',
      value: formatPercent(metrics.precision),
    },
    {
      label: 'Recall',
      value: formatPercent(metrics.recall),
    },
    {
      label: 'F1 score',
      value: formatDecimal(metrics.f1_score, 3),
    },
    {
      label: 'False + / false −',
      tone: 'coral',
      value: `${formatCount(
        metrics.false_positive_hits,
      )} / ${formatCount(metrics.false_negative_misses)}`,
    },
    {
      label: 'Est. latency saved',
      value: formatLatency(metrics.estimated_latency_saved_ms),
    },
    {
      label: 'Est. provider cost saved',
      tone: 'teal',
      value: formatUsd(metrics.estimated_provider_cost_saved_usd, 4),
    },
  ] satisfies MetricProps[];

  return (
    <section aria-labelledby="benchmark-summary-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ui-label text-(--teal)">Measured run</p>
          <h3
            className="font-display mt-1 text-2xl italic"
            id="benchmark-summary-heading"
          >
            {result.dataset.name}
          </h3>
          <p className="font-data mt-2 text-xs text-(--text-muted)">
            Threshold {formatDecimal(result.threshold, 2)} ·{' '}
            {formatCount(result.repetitions)}{' '}
            repetition{result.repetitions === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {metricItems.map((metric) => (
          <Metric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            {...('tone' in metric ? { tone: metric.tone } : {})}
          />
        ))}
      </dl>

      <p className="font-data mt-5 text-[10px]/5  text-(--text-faint)">
        Latency and classification values are measured. Latency saved, token
        count, provider cost savings, and threshold-series latency are estimates
        based on this run—not billing records or exact token usage.
      </p>
    </section>
  );
}
