import { useState } from "react";

import { CacheStats } from "./components/CacheStats";
import { QueryForm } from "./components/QueryForm";
import { ResponseCard } from "./components/ResponseCard";
import { useQuery } from "./hooks/useQuery";

export default function App(): JSX.Element {
  const { state, submit } = useQuery();
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  async function handleSubmit(prompt: string): Promise<void> {
    if (await submit(prompt)) {
      setStatsRefreshKey((current) => current + 1);
    }
  }

  return (
    <main>
      <h1>Semantic Cache</h1>
      <p>Semantically similar prompts can reuse an earlier response.</p>
      <QueryForm isLoading={state.status === "loading"} onSubmit={handleSubmit} />
      {state.status === "error" && (
        <p role="alert">{state.error.detail ?? "The request failed."}</p>
      )}
      {state.status === "success" && <ResponseCard result={state.data} />}
      <CacheStats refreshKey={statsRefreshKey} />
    </main>
  );
}
