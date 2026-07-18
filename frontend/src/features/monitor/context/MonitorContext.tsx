import {
  useCallback,
  useMemo,
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
}: Readonly<MonitorProviderProps>): JSX.Element {
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
            providerCalled: result.provider_called,
          },
          ...current,
        ].slice(0, MAX_TRACES),
      );
      await refreshCacheState(false);
    },
    [refreshCacheState, submit],
  );

  const clearTraces = useCallback((): void => {
    setTraces([]);
  }, []);

  const contextValue = useMemo(
    () => ({
      clearTraces,
      queryState,
      submitPrompt,
      traces,
    }),
    [clearTraces, queryState, submitPrompt, traces],
  );

  return (
    <MonitorContext.Provider value={contextValue}>
      {children}
    </MonitorContext.Provider>
  );
}
