import type { QueryResponse } from "../types/api";

interface ResponseCardProps {
  result: QueryResponse;
}

export function ResponseCard({ result }: ResponseCardProps): JSX.Element {
  const similarity = result.similarity_score?.toFixed(3) ?? "n/a";
  const verdict = result.cache_hit ? "CACHE HIT" : "FRESH RESPONSE";
  const verdictColor = result.cache_hit ? "var(--gold)" : "var(--coral)";

  return (
    <article aria-live="polite" className="border-y border-[var(--hairline)] bg-[var(--surface)] px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] pb-4">
        <h2 className="font-display text-xl italic">Latest response</h2>
        <span className="font-data text-[10px]" style={{ color: verdictColor }}>
          {verdict}
        </span>
      </header>

      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-soft)]">
        {result.response}
      </p>

      <dl className="mt-6 grid grid-cols-1 border-t border-[var(--hairline)] min-[520px]:grid-cols-3">
        <div className="py-3 min-[520px]:border-r min-[520px]:border-[var(--hairline)]">
          <dt className="ui-label text-[var(--text-faint)]">Source</dt>
          <dd className="font-data mt-1 text-xs text-[var(--text-soft)]">
            {result.cache_hit ? "semantic cache" : "provider"}
          </dd>
        </div>
        <div className="border-t border-[var(--hairline)] py-3 min-[520px]:border-r min-[520px]:border-t-0 min-[520px]:border-[var(--hairline)] min-[520px]:px-4">
          <dt className="ui-label text-[var(--text-faint)]">Similarity</dt>
          <dd className="font-data mt-1 text-xs text-[var(--teal)]">{similarity}</dd>
        </div>
        <div className="border-t border-[var(--hairline)] py-3 min-[520px]:border-t-0 min-[520px]:pl-4">
          <dt className="ui-label text-[var(--text-faint)]">Latency</dt>
          <dd className="font-data mt-1 text-xs text-[var(--text-soft)]">
            {result.latency_ms.toFixed(1)} ms
          </dd>
        </div>
      </dl>
    </article>
  );
}
