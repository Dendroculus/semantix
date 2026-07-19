import type { BenchmarkQueryResult } from "../types";

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
}: Readonly<BenchmarkResultsTableProps>): JSX.Element {
  return (
    <section aria-labelledby="benchmark-results-heading" className="mt-12">
      <h3
        className="font-display text-2xl italic"
        id="benchmark-results-heading"
      >
        Per-query evidence
      </h3>
      <p className="font-data mt-2 text-[10px] text-(--text-faint) min-[960px]:hidden">
        Scroll horizontally to inspect every evidence column.
      </p>
      <section
        aria-label="Scrollable per-query benchmark evidence"
        className="scrollbar-thin mt-5 overflow-x-auto border-y border-(--hairline)"
      >
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="bg-(--ink)">
            <tr className="ui-label text-(--text-faint)">
              <th className="p-3 font-medium" scope="col">#</th>
              <th className="p-3 font-medium" scope="col">Category</th>
              <th className="p-3 font-medium" scope="col">Query</th>
              <th className="p-3 font-medium" scope="col">Expected</th>
              <th className="p-3 font-medium" scope="col">Actual</th>
              <th className="p-3 font-medium" scope="col">Score</th>
              <th className="p-3 font-medium" scope="col">Latency</th>
              <th className="p-3 font-medium" scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody className="font-data text-[11px]">
            {results.map((result) => (
              <tr
                className="border-t border-(--hairline) align-top transition-colors hover:bg-[rgba(234,230,221,0.025)]"
                key={`${result.repetition}-${result.case_id}`}
              >
                <td className="px-3 py-4 text-(--text-faint)">
                  {result.sequence}
                </td>
                <td className="px-3 py-4 capitalize text-(--text-muted)">
                  {label(result.category)}
                </td>
                <td className="max-w-md px-3 py-4 leading-5 text-(--text-soft)">
                  {result.prompt}
                </td>
                <td className="px-3 py-4 text-(--text-muted)">
                  {decision(result.expected_cache_hit)}
                </td>
                <td
                  className={
                    result.actual_cache_hit
                      ? "px-3 py-4 text-(--teal)"
                      : "px-3 py-4 text-(--coral)"
                  }
                >
                  {decision(result.actual_cache_hit)}
                </td>
                <td className="px-3 py-4 tabular-nums">
                  {result.similarity_score === null
                    ? "n/a"
                    : result.similarity_score.toFixed(3)}
                </td>
                <td className="px-3 py-4 tabular-nums">
                  {result.latency_ms.toFixed(1)} ms
                </td>
                <td
                  className={`px-3 py-4 capitalize ${
                    result.correct
                      ? "text-(--teal)"
                      : "text-(--coral)"
                  }`}
                >
                  {label(result.outcome)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
