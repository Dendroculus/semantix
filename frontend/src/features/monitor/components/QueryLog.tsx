import type { QueryTrace } from "../types";

interface QueryLogProps {
  traces: QueryTrace[];
  threshold: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour12: false });
}

export function QueryLog({
  traces,
  threshold,
}: Readonly<QueryLogProps>): JSX.Element {
  return (
    <section className="mt-16 border-t border-(--hairline) pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-6">
        <h2 className="font-display text-2xl italic">Recent query trace</h2>
        <span className="font-data text-[10px] text-(--text-faint)">
          {traces.length.toString().padStart(2, "0")} records
        </span>
      </div>

      {traces.length === 0 ? (
        <div className="border-y border-(--hairline) py-6">
          <p className="font-display text-xl italic text-(--text-soft)">
            No query traces yet
          </p>
          <p className="font-data mt-2 max-w-2xl text-[10px]/5 text-(--text-muted)">
            The first probe seeds the visible history. Later prompts show their
            nearest-cache score and projected decision here.
          </p>
        </div>
      ) : (
        <div>
          <div className="ui-label hidden grid-cols-[90px_72px_minmax(180px,1fr)_72px_90px] gap-4 border-b border-(--hairline) pb-3 text-(--text-faint) min-[760px]:grid">
            <span>Time</span>
            <span>Score</span>
            <span>Query</span>
            <span>Projection</span>
            <span className="text-right">Latency</span>
          </div>

          {traces.map((trace) => {
            const isProjectedHit =
              trace.similarity !== null && trace.similarity >= threshold;

            return (
              <div
                key={trace.id}
                className="font-data grid gap-2 border-b border-l-2 border-[rgba(234,230,221,0.05)] py-4 pr-2 pl-3 text-[11px] transition-colors hover:bg-[rgba(234,230,221,0.025)] min-[760px]:grid-cols-[90px_72px_minmax(180px,1fr)_72px_90px] min-[760px]:gap-4 min-[760px]:border-l-0 min-[760px]:px-0 min-[760px]:py-3"
                style={{
                  borderLeftColor: isProjectedHit
                    ? "var(--gold)"
                    : "var(--coral)",
                }}
              >
                <div className="flex justify-between gap-4 min-[760px]:contents">
                  <time className="text-(--text-faint)">
                    <span className="ui-label mr-2 min-[760px]:hidden">
                      Time
                    </span>
                    {formatTime(trace.recordedAt)}
                  </time>
                  <span className="text-(--teal)">
                    <span className="ui-label mr-2 text-(--text-faint) min-[760px]:hidden">
                      Score
                    </span>
                    {trace.similarity === null ? "n/a" : trace.similarity.toFixed(3)}
                  </span>
                </div>

                <span className="wrap-break-word text-(--text-soft) min-[760px]:truncate">
                  {trace.prompt}
                </span>

                <div className="flex justify-between gap-4 min-[760px]:contents">
                  <span style={{ color: isProjectedHit ? "var(--gold)" : "var(--coral)" }}>
                    <span className="ui-label mr-2 text-(--text-faint) min-[760px]:hidden">
                      Projection
                    </span>
                    {isProjectedHit ? "HIT" : "MISS"}
                  </span>
                  <span className="text-(--text-muted) min-[760px]:text-right">
                    <span className="ui-label mr-2 text-(--text-faint) min-[760px]:hidden">
                      Latency
                    </span>
                    {trace.latencyMs.toFixed(1)} ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
