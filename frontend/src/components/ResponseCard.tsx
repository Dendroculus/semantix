import type { QueryResponse } from "../types/api";

interface ResponseCardProps {
  result: QueryResponse;
}

export function ResponseCard({ result }: ResponseCardProps): JSX.Element {
  const similarity = result.similarity_score === null
    ? "Not available"
    : result.similarity_score.toFixed(3);

  return (
    <article aria-live="polite">
      <h2>Response</h2>
      <p>{result.response}</p>
      <dl>
        <dt>Source</dt>
        <dd>{result.cache_hit ? "Semantic cache" : "Hugging Face"}</dd>
        <dt>Similarity</dt>
        <dd>{similarity}</dd>
        <dt>Latency</dt>
        <dd>{result.latency_ms.toFixed(1)} ms</dd>
      </dl>
    </article>
  );
}
