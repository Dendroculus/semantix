import type {
  BenchmarkRunResponse,
  ThresholdEvaluation,
} from "../types";
import { LineChart } from "./LineChart";
import { SimilarityDistribution } from "./SimilarityDistribution";

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
  const percent = (value: number): string => `${Math.round(value * 100)}%`;
  const number = (value: number): string => value.toFixed(0);

  return (
    <section aria-labelledby="benchmark-charts-heading" className="mt-12">
      <h3
        className="font-display text-2xl italic"
        id="benchmark-charts-heading"
      >
        Threshold evaluation
      </h3>
      <p className="mt-2 max-w-3xl text-sm/6  text-(--text-muted)">
        Threshold series reclassify the measured nearest-match scores. Their
        latency line uses this run’s measured average hit and miss latency as
        an estimate; it does not make additional provider calls.
      </p>
      <div className="mt-7 grid gap-8 md:grid-cols-2">
        <LineChart
          series={[
            {
              color: "var(--gold)",
              label: "Hit rate",
              points: points(evaluations, (item) => item.hit_rate),
            },
          ]}
          title="Hit rate vs. threshold"
          valueLabel={percent}
        />
        <LineChart
          series={[
            {
              color: "var(--teal)",
              label: "Precision",
              points: points(evaluations, (item) => item.precision),
            },
            {
              color: "var(--coral)",
              label: "Recall",
              points: points(evaluations, (item) => item.recall),
            },
          ]}
          title="Precision / recall vs. threshold"
          valueLabel={percent}
        />
        <LineChart
          series={[
            {
              color: "var(--gold)",
              label: "Estimated average latency",
              points: points(evaluations, (item) => item.average_latency_ms),
            },
          ]}
          title="Average latency vs. threshold"
          valueLabel={(value) => `${number(value)} ms`}
        />
        <LineChart
          series={[
            {
              color: "var(--teal)",
              label: "Provider calls avoided",
              points: points(
                evaluations,
                (item) => item.provider_calls_avoided,
              ),
            },
          ]}
          title="Provider calls avoided vs. threshold"
          valueLabel={number}
        />
        <SimilarityDistribution results={result.query_results} />
      </div>
    </section>
  );
}
