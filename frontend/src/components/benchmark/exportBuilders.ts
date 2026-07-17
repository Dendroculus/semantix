import type {
  BenchmarkQueryResult,
  BenchmarkRunResponse,
} from "../../types/benchmark";

const CSV_COLUMNS: ReadonlyArray<keyof BenchmarkQueryResult> = [
  "sequence",
  "repetition",
  "case_id",
  "category",
  "prompt",
  "expected_cache_hit",
  "actual_cache_hit",
  "correct",
  "outcome",
  "similarity_score",
  "latency_ms",
  "provider_called",
  "matched_prompt",
];

function csvCell(value: string | number | boolean | null): string {
  if (value === null) {
    return "";
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildBenchmarkJson(result: BenchmarkRunResponse): string {
  return JSON.stringify(result, null, 2);
}

export function buildBenchmarkCsv(result: BenchmarkRunResponse): string {
  const header = CSV_COLUMNS.join(",");
  const rows = result.query_results.map((query) =>
    CSV_COLUMNS.map((column) => csvCell(query[column])).join(","),
  );
  return [header, ...rows].join("\r\n");
}

export function downloadBenchmark(
  result: BenchmarkRunResponse,
  format: "json" | "csv",
): void {
  const content =
    format === "json" ? buildBenchmarkJson(result) : buildBenchmarkCsv(result);
  const blob = new Blob([content], {
    type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `semantix-benchmark-${result.run_id}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
