import { MarkdownContent } from "@/shared/components/markdown/MarkdownContent";
import type { QueryResponse } from "../types";

interface ResponseCardProps {
  result: QueryResponse;
}

function formatCacheAge(seconds: number | null): string {
  if (seconds === null) {
    return "n/a";
  }

  if (seconds < 1) {
    return "<1 s";
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function explainDecision(result: QueryResponse): string {
  const score = result.similarity_score?.toFixed(3);
  const threshold = result.similarity_threshold.toFixed(3);

  if (result.cache_hit && score !== undefined) {
    return `Reused a cached response because similarity ${score} met the ${threshold} threshold.`;
  }

  if (result.generation_skipped && !result.provider_called) {
    return "Awaited an identical in-flight request instead of making a duplicate provider call.";
  }

  if (score === undefined) {
    return "Generated a fresh response because no cached entry was available to compare.";
  }

  if (result.similarity_score !== null && result.similarity_score < result.similarity_threshold) {
    return `Generated a fresh response because the nearest similarity ${score} was below the ${threshold} threshold.`;
  }

  return "Generated a fresh response because the nearest candidate was unavailable at reuse time.";
}

export function ResponseCard({
  result,
}: Readonly<ResponseCardProps>): JSX.Element {
  const similarity =
    result.similarity_score?.toFixed(3) ?? "n/a";
  const threshold = result.similarity_threshold.toFixed(3);
  const cacheAge = formatCacheAge(result.cache_entry_age_seconds);
  const explanation = explainDecision(result);

  const isCoalesced =
    !result.cache_hit &&
    result.generation_skipped &&
    !result.provider_called;
  let verdict = "FRESH RESPONSE";
  if (result.cache_hit) {
    verdict = "CACHE HIT";
  } else if (isCoalesced) {
    verdict = "COALESCED RESPONSE";
  }

  const verdictColor = result.cache_hit
    ? "var(--gold)"
    : "var(--coral)";

  return (
    <article
      aria-live="polite"
      className="border-y border-(--hairline) bg-(--surface) px-4 py-5 sm:px-6"
    >
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-(--hairline) pb-4">
        <h2 className="font-display text-xl italic">
          Latest response
        </h2>

        <span
          className="font-data text-[10px]"
          style={{ color: verdictColor }}
        >
          {verdict}
        </span>
      </header>

      <MarkdownContent
        className="text-sm text-(--text-soft)"
        markdown={result.response}
      />

      <section
        aria-label="Cache decision explanation"
        className="mt-6 border-t border-(--hairline) pt-4"
      >
        <p className="ui-label text-(--text-faint)">
          Decision evidence
        </p>

        <p className="mt-2 text-sm/6  text-(--text-soft)">
          {explanation}
        </p>

        <dl className="mt-4 grid grid-cols-1 border-t border-(--hairline) min-[520px]:grid-cols-2 min-[860px]:grid-cols-4">
          <div className="py-3 min-[520px]:border-r min-[520px]:border-(--hairline)">
            <dt className="ui-label text-(--text-faint)">
              Similarity
            </dt>

            <dd className="font-data mt-1 text-xs text-(--teal)">
              {similarity}
            </dd>
          </div>

          <div className="border-t border-(--hairline) py-3 min-[520px]:border-t-0 min-[520px]:pl-4 min-[860px]:border-r min-[860px]:border-(--hairline)">
            <dt className="ui-label text-(--text-faint)">
              Threshold used
            </dt>

            <dd className="font-data mt-1 text-xs text-(--text-soft)">
              {threshold}
            </dd>
          </div>

          <div className="border-t border-(--hairline) py-3 min-[520px]:border-r min-[520px]:border-(--hairline) min-[860px]:border-t-0 min-[860px]:pl-4">
            <dt className="ui-label text-(--text-faint)">
              Generation
            </dt>

            <dd className="font-data mt-1 text-xs text-(--text-soft)">
              {result.generation_skipped ? "Skipped" : "Ran"}
            </dd>
          </div>

          <div className="border-t border-(--hairline) py-3 min-[520px]:pl-4 min-[860px]:border-t-0">
            <dt className="ui-label text-(--text-faint)">
              Provider
            </dt>

            <dd className="font-data mt-1 text-xs text-(--text-soft)">
              {result.provider_called ? "Called" : "Not called"}
            </dd>
          </div>

          <div className="border-t border-(--hairline) py-3 min-[520px]:col-span-2 min-[520px]:border-r min-[520px]:border-(--hairline) min-[860px]:col-span-2">
            <dt className="ui-label text-(--text-faint)">
              Matched cached prompt
            </dt>

            <dd className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-(--text-soft)">
              {result.matched_prompt ?? "No cached entry reused"}
            </dd>
          </div>

          <div className="border-t border-(--hairline) py-3 min-[520px]:border-r min-[520px]:border-(--hairline) min-[520px]:pl-4">
            <dt className="ui-label text-(--text-faint)">
              Cache entry age
            </dt>

            <dd className="font-data mt-1 text-xs text-(--text-soft)">
              {result.cache_entry_created_at === null ? (
                cacheAge
              ) : (
                <time
                  dateTime={result.cache_entry_created_at}
                  title={`Created ${result.cache_entry_created_at}`}
                >
                  {cacheAge}
                </time>
              )}
            </dd>
          </div>

          <div className="border-t border-(--hairline) py-3 min-[520px]:pl-4">
            <dt className="ui-label text-(--text-faint)">
              Request latency
            </dt>

            <dd className="font-data mt-1 text-xs text-(--text-soft)">
              {result.latency_ms.toFixed(1)} ms
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
