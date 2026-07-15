import type { QueryResponse } from "../types/api";

interface ResponseCardProps {
  result: QueryResponse;
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps): JSX.Element {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-200">{value}</dd>
    </div>
  );
}

export function ResponseCard({ result }: ResponseCardProps): JSX.Element {
  const similarity =
    result.similarity_score === null
      ? "Not available"
      : (result.similarity_score * 100).toFixed(1) + "%";

  return (
    <article
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/65 shadow-2xl shadow-black/20 backdrop-blur-xl"
    >
      <header className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-400/10 text-indigo-300">
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z" />
              <path d="m8.5 12 2.2 2.2 4.8-5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Response</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Completed in {result.latency_ms.toFixed(1)} ms
            </p>
          </div>
        </div>

        <span
          className={[
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            result.cache_hit
              ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
              : "border-indigo-400/20 bg-indigo-400/5 text-indigo-300",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              result.cache_hit ? "bg-emerald-400" : "bg-indigo-400",
            ].join(" ")}
          />
          {result.cache_hit ? "Cache hit" : "Fresh generation"}
        </span>
      </header>

      <div className="p-5 sm:p-6">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300 sm:text-[15px]">
          {result.response}
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Source" value={result.cache_hit ? "Semantic cache" : "Hugging Face"} />
          <Metric label="Similarity" value={similarity} />
          <Metric label="Latency" value={result.latency_ms.toFixed(1) + " ms"} />
        </dl>
      </div>
    </article>
  );
}
