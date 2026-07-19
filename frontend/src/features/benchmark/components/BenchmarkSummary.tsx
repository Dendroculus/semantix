import type { BenchmarkRunResponse } from "../types";

interface BenchmarkSummaryProps {
  result: BenchmarkRunResponse;
}

interface MetricProps {
  label: string;
  tone?: "gold" | "teal" | "coral";
  value: string;
}

const TONE_CLASS: Record<NonNullable<MetricProps["tone"]>, string> = {
  gold: "text-(--gold)",
  teal: "text-(--teal)",
  coral: "text-(--coral)",
};

function Metric({
  label,
  tone,
  value,
}: Readonly<MetricProps>): JSX.Element {
  const valueClass =
    tone === undefined ? "text-(--text)" : TONE_CLASS[tone];

  return (
    <div className="border-t border-(--hairline) pt-3">
      <dt className="ui-label text-(--text-faint)">{label}</dt>
      <dd className={`font-data mt-2 text-lg tabular-nums ${valueClass}`}>
        {value}
      </dd>
    </div>
  );
}

function latency(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)} ms`;
}

export function BenchmarkSummary({
  result,
}: Readonly<BenchmarkSummaryProps>): JSX.Element {
  const { metrics } = result;

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
            Threshold {result.threshold.toFixed(2)} · {result.repetitions}{" "}
            repetition{result.repetitions === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <Metric label="Total queries" value={String(metrics.total_queries)} />
        <Metric
          label="Cache hit rate"
          tone="gold"
          value={`${(metrics.hit_rate * 100).toFixed(1)}%`}
        />
        <Metric
          label="Provider calls"
          tone="coral"
          value={String(metrics.provider_calls)}
        />
        <Metric
          label="Calls avoided"
          tone="teal"
          value={String(metrics.provider_calls_avoided)}
        />
        <Metric label="Average latency" value={latency(metrics.average_latency_ms)} />
        <Metric label="Median latency" value={latency(metrics.median_latency_ms)} />
        <Metric label="P95 latency" value={latency(metrics.p95_latency_ms)} />
        <Metric
          label="Hit / miss latency"
          value={`${latency(metrics.average_cache_hit_latency_ms)} / ${latency(metrics.average_cache_miss_latency_ms)}`}
        />
        <Metric label="Precision" value={`${(metrics.precision * 100).toFixed(1)}%`} />
        <Metric label="Recall" value={`${(metrics.recall * 100).toFixed(1)}%`} />
        <Metric label="F1 score" value={metrics.f1_score.toFixed(3)} />
        <Metric
          label="False + / false −"
          tone="coral"
          value={`${metrics.false_positive_hits} / ${metrics.false_negative_misses}`}
        />
        <Metric
          label="Est. latency saved"
          value={latency(metrics.estimated_latency_saved_ms)}
        />
        <Metric
          label="Est. provider cost saved"
          tone="teal"
          value={`$${metrics.estimated_provider_cost_saved_usd.toFixed(4)}`}
        />
      </dl>

      <p className="font-data mt-5 text-[10px]/5  text-(--text-faint)">
        Latency and classification values are measured. Latency saved, token
        count, provider cost savings, and threshold-series latency are
        estimates based on this run—not billing records or exact token usage.
      </p>
    </section>
  );
}
