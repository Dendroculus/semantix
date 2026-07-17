import type { BenchmarkQueryResult } from "../../types/benchmark";

interface BenchmarkResultsTableProps {
  results: BenchmarkQueryResult[];
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function decision(value: boolean): string {
  return value ? "HIT" : "MISS";
}

export function BenchmarkResultsTable({
  results,
}: BenchmarkResultsTableProps): JSX.Element {
  return (
    <section aria-labelledby="benchmark-results-heading" className="mt-12">
      <h3
        className="font-display text-2xl italic"
        id="benchmark-results-heading"
      >
        Per-query evidence
      </h3>
      <div className="mt-5 overflow-x-auto border-y border-[var(--hairline)]">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="ui-label text-[var(--text-faint)]">
              <th className="px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Query</th>
              <th className="px-3 py-3 font-medium">Expected</th>
              <th className="px-3 py-3 font-medium">Actual</th>
              <th className="px-3 py-3 font-medium">Score</th>
              <th className="px-3 py-3 font-medium">Latency</th>
              <th className="px-3 py-3 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody className="font-data text-[11px]">
            {results.map((result) => (
              <tr
                className="border-t border-[var(--hairline)] align-top"
                key={`${result.repetition}-${result.case_id}`}
              >
                <td className="px-3 py-4 text-[var(--text-faint)]">
                  {result.sequence}
                </td>
                <td className="px-3 py-4 capitalize text-[var(--text-muted)]">
                  {label(result.category)}
                </td>
                <td className="max-w-md px-3 py-4 leading-5 text-[var(--text-soft)]">
                  {result.prompt}
                </td>
                <td className="px-3 py-4">
                  {decision(result.expected_cache_hit)}
                </td>
                <td className="px-3 py-4">
                  {decision(result.actual_cache_hit)}
                </td>
                <td className="px-3 py-4">
                  {result.similarity_score === null
                    ? "n/a"
                    : result.similarity_score.toFixed(3)}
                </td>
                <td className="px-3 py-4">
                  {result.latency_ms.toFixed(1)} ms
                </td>
                <td
                  className={`px-3 py-4 capitalize ${
                    result.correct
                      ? "text-[var(--teal)]"
                      : "text-[var(--coral)]"
                  }`}
                >
                  {label(result.outcome)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
