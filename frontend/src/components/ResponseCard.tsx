import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { QueryResponse } from "../types/api";
import { unwrapOuterMarkdownFence } from "../lib/markdown";

interface ResponseCardProps {
  result: QueryResponse;
}

const markdownComponents: Components = {
  p: ({ ...props }) => (
    <p className="mb-3 whitespace-pre-wrap break-words leading-7 last:mb-0" {...props} />
  ),
  strong: ({ ...props }) => <strong className="font-semibold text-[var(--text)]" {...props} />,
  em: ({ ...props }) => <em {...props} />,
  a: ({ ...props }) => (
    <a
      className="text-[var(--teal)] underline decoration-[rgba(91,156,148,0.35)] underline-offset-4 hover:text-[var(--text)]"
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    />
  ),
  ul: ({ ...props }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: ({ ...props }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  li: ({ ...props }) => <li className="leading-6" {...props} />,
  blockquote: ({ ...props }) => (
    <blockquote
      className="mb-3 border-l-2 border-[var(--hairline)] pl-4 italic text-[var(--text-muted)] last:mb-0"
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code className={`font-data block whitespace-pre-wrap break-words ${className ?? ""}`} {...props}>
        {children}
      </code>
    ) : (
      <code
        className="font-data rounded bg-[rgba(234,230,221,0.08)] px-1.5 py-0.5 text-[0.85em] text-[var(--gold)]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ ...props }) => (
    <pre
      className="scrollbar-thin mb-3 overflow-x-auto rounded border border-[var(--hairline)] bg-[rgba(0,0,0,0.25)] p-3 text-xs last:mb-0"
      {...props}
    />
  ),
  h1: ({ ...props }) => <h3 className="font-display mb-2 text-lg italic" {...props} />,
  h2: ({ ...props }) => <h3 className="font-display mb-2 text-lg italic" {...props} />,
  h3: ({ ...props }) => <h3 className="font-display mb-2 text-base italic" {...props} />,
  table: ({ ...props }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="font-data w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: ({ ...props }) => (
    <th className="border-b border-[var(--hairline)] px-2 py-1.5 text-left text-[var(--text-faint)]" {...props} />
  ),
  td: ({ ...props }) => <td className="border-b border-[rgba(234,230,221,0.05)] px-2 py-1.5" {...props} />,
};

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

      <div className="text-sm text-[var(--text-soft)]">
        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
          {unwrapOuterMarkdownFence(result.response)}
        </ReactMarkdown>
      </div>

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
          <dt className="ui-label text-[var(--text-soft)]">Latency</dt>
          <dd className="font-data mt-1 text-xs text-[var(--text-soft)]">
            {result.latency_ms.toFixed(1)} ms
          </dd>
        </div>
      </dl>
    </article>
  );
}