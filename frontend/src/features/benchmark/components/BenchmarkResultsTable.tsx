import {
  formatCount,
  formatLatency,
  formatSimilarity,
} from '@/shared/lib/formatters';
import type { BenchmarkQueryResult } from '../types';

interface BenchmarkResultsTableProps {
  results: BenchmarkQueryResult[];
}

const TABLE_HEADERS = [
  '#',
  'Category',
  'Query',
  'Expected',
  'Actual',
  'Score',
  'Latency',
  'Outcome',
] as const;

function formatLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function formatDecision(value: boolean): string {
  return value ? 'HIT' : 'MISS';
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
              {TABLE_HEADERS.map((header) => (
                <th className="p-3 font-medium" key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-data text-[11px]">
            {results.map((result) => (
              <tr
                className="border-t border-(--hairline) align-top transition-colors hover:bg-[rgba(234,230,221,0.025)]"
                key={`${result.repetition}-${result.case_id}`}
              >
                <td className="px-3 py-4 text-(--text-faint)">
                  {formatCount(result.sequence)}
                </td>
                <td className="px-3 py-4 capitalize text-(--text-muted)">
                  {formatLabel(result.category)}
                </td>
                <td className="max-w-md px-3 py-4 leading-5 text-(--text-soft)">
                  {result.prompt}
                </td>
                <td className="px-3 py-4 text-(--text-muted)">
                  {formatDecision(result.expected_cache_hit)}
                </td>
                <td
                  className={
                    result.actual_cache_hit
                      ? 'px-3 py-4 text-(--teal)'
                      : 'px-3 py-4 text-(--coral)'
                  }
                >
                  {formatDecision(result.actual_cache_hit)}
                </td>
                <td className="px-3 py-4 tabular-nums">
                  {formatSimilarity(result.similarity_score)}
                </td>
                <td className="px-3 py-4 tabular-nums">
                  {formatLatency(result.latency_ms)}
                </td>
                <td
                  className={`px-3 py-4 capitalize ${
                    result.correct ? 'text-(--teal)' : 'text-(--coral)'
                  }`}
                >
                  {formatLabel(result.outcome)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
