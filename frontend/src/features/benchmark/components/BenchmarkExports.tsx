import type { BenchmarkRunResponse } from "../types";
import { downloadBenchmark } from "../lib/exportBuilders";

interface BenchmarkExportsProps {
  result: BenchmarkRunResponse;
}

export function BenchmarkExports({
  result,
}: BenchmarkExportsProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        className="ui-label border border-[var(--hairline)] px-4 py-2 text-[var(--text-soft)]"
        type="button"
        onClick={() => downloadBenchmark(result, "json")}
      >
        Export JSON
      </button>
      <button
        className="ui-label border border-[var(--hairline)] px-4 py-2 text-[var(--text-soft)]"
        type="button"
        onClick={() => downloadBenchmark(result, "csv")}
      >
        Export CSV
      </button>
    </div>
  );
}
