import type { BenchmarkRunResponse } from '../types';
import { downloadBenchmark } from '../lib/exportBuilders';

interface BenchmarkExportsProps {
  result: BenchmarkRunResponse;
}

export function BenchmarkExports({
  result,
}: Readonly<BenchmarkExportsProps>): JSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        className="ui-label min-h-10 border border-(--hairline) px-4 py-2 text-(--text-soft) transition-colors hover:border-(--teal) hover:text-(--teal) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--teal) active:translate-y-px"
        type="button"
        onClick={() => downloadBenchmark(result, 'json')}
      >
        Export JSON
      </button>
      <button
        className="ui-label min-h-10 border border-(--hairline) px-4 py-2 text-(--text-soft) transition-colors hover:border-(--teal) hover:text-(--teal) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--teal) active:translate-y-px"
        type="button"
        onClick={() => downloadBenchmark(result, 'csv')}
      >
        Export CSV
      </button>
    </div>
  );
}
