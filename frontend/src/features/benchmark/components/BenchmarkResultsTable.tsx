import type { BenchmarkQueryResult } from '../types';
import { BENCHMARK_RESULT_COLUMNS } from '../lib/resultColumns';

interface BenchmarkResultsTableProps {
  results: BenchmarkQueryResult[];
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
              {BENCHMARK_RESULT_COLUMNS.map((column) => (
                <th
                  className={`p-3 font-medium ${column.headerClassName ?? ''}`}
                  key={column.id}
                  scope="col"
                >
                  {column.header}
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
                {BENCHMARK_RESULT_COLUMNS.map((column) => (
                  <td
                    className={
                      typeof column.cellClassName === 'function'
                        ? column.cellClassName(result)
                        : column.cellClassName
                    }
                    key={column.id}
                  >
                    {column.render(result)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
