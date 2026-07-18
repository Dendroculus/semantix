import {
  useCallback,
  useState,
  type ReactNode,
} from "react";

import { MonitorContext } from "./monitorState";
import { useCacheControl } from "@/features/cache/hooks/useCacheControl";
import { useQuery } from "../hooks/useQuery";
import type { QueryTrace } from "../types";

const MAX_TRACES = 40;

interface MonitorProviderProps {
  children: ReactNode;
}

export function MonitorProvider({
  children,
}: MonitorProviderProps): JSX.Element {
  const { refreshCacheState } = useCacheControl();
  const { state: queryState, submit } = useQuery();
  const [traces, setTraces] = useState<QueryTrace[]>([]);

  const submitPrompt = useCallback(
    async (prompt: string): Promise<void> => {
      const result = await submit(prompt);
      if (result === null) {
        return;
      }

      setTraces((current) =>
        [
          {
            id: crypto.randomUUID(),
            prompt,
            similarity: result.similarity_score,
            latencyMs: result.latency_ms,
            recordedAt: new Date(),
            actualCacheHit: result.cache_hit,
          },
          ...current,
        ].slice(0, MAX_TRACES),
      );
      await refreshCacheState(false);
    },
    [refreshCacheState, submit],
  );

  return (
    <MonitorContext.Provider
      value={{
        clearTraces: () => setTraces([]),
        queryState,
        submitPrompt,
        traces,
      }}
    >
      {children}
    </MonitorContext.Provider>
  );
}
