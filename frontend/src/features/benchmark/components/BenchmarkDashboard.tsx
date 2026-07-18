import { useBenchmark } from "../hooks/useBenchmark";
import { BenchmarkCharts } from "./BenchmarkCharts";
import { BenchmarkControls } from "./BenchmarkControls";
import { BenchmarkExports } from "./BenchmarkExports";
import { BenchmarkResultsTable } from "./BenchmarkResultsTable";
import { BenchmarkRunWarning } from "./BenchmarkRunWarning";
import { BenchmarkSummary } from "./BenchmarkSummary";

export function BenchmarkDashboard(): JSX.Element {
  const controller = useBenchmark();
  const { error, isRunning, result, selectedDataset } = controller;

  return (
    <section
      aria-labelledby="benchmark-heading"
      className="pb-4"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ui-label text-(--gold)">Controlled evaluation</p>
          <h1
            className="font-display mt-1 text-3xl italic"
            id="benchmark-heading"
          >
            Benchmark laboratory
          </h1>
          <p className="mt-3 max-w-3xl text-sm/6  text-(--text-muted)">
            Measure cache quality, latency, provider savings, and threshold
            trade-offs against prompts with explicit expected decisions.
          </p>
        </div>
        {result !== null && <BenchmarkExports result={result} />}
      </div>

      <BenchmarkControls controller={controller} />
      {selectedDataset !== null && (
        <p className="font-data mt-3 text-[10px]/5  text-(--text-faint)">
          {selectedDataset.description}
        </p>
      )}
      <BenchmarkRunWarning controller={controller} />

      {isRunning && (
        <p className="font-data mt-6 text-xs text-(--gold)" role="status">
          RUNNING CONTROLLED QUERY SEQUENCE / DO NOT REFRESH
        </p>
      )}
      {error !== null && (
        <p className="font-data mt-6 text-xs text-(--coral)" role="alert">
          BENCHMARK FAILED / {error}
        </p>
      )}

      {result !== null && (
        <>
          <BenchmarkSummary result={result} />
          <BenchmarkCharts result={result} />
          <BenchmarkResultsTable results={result.query_results} />
        </>
      )}
    </section>
  );
}
