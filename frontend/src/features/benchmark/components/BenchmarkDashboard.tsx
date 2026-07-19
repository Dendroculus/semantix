import { useBenchmark } from "../hooks/useBenchmark";
import { BenchmarkCharts } from "./BenchmarkCharts";
import { BenchmarkControls } from "./BenchmarkControls";
import { BenchmarkExports } from "./BenchmarkExports";
import { BenchmarkResultsTable } from "./BenchmarkResultsTable";
import { BenchmarkResultsSkeleton } from "./BenchmarkResultsSkeleton";
import { BenchmarkRunWarning } from "./BenchmarkRunWarning";
import { BenchmarkSummary } from "./BenchmarkSummary";

export function BenchmarkDashboard(): JSX.Element {
  const controller = useBenchmark();
  const {
    datasetsLoading,
    error,
    isRunning,
    result,
    selectedDataset,
    showWarning,
  } = controller;

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

      {isRunning && <BenchmarkResultsSkeleton />}
      {error !== null && (
        <div
          className="mt-6 border-l-2 border-(--coral) bg-[rgba(194,96,74,0.06)] px-4 py-3"
          role="alert"
        >
          <p className="ui-label text-(--coral)">Benchmark failed</p>
          <p className="font-data mt-1 text-[11px]/5 text-(--text-soft)">
            {error}
          </p>
        </div>
      )}

      {!datasetsLoading &&
        result === null &&
        !isRunning &&
        !showWarning &&
        error === null && (
          <section className="mt-8 border-y border-(--hairline) py-6">
            <p className="font-display text-xl italic text-(--text-soft)">
              No measured run yet
            </p>
            <p className="mt-2 max-w-2xl text-sm/6 text-(--text-muted)">
              Review the selected dataset and threshold to see the expected
              provider work before starting a controlled run.
            </p>
          </section>
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
