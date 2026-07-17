import { createContext } from "react";

import type { QueryState, QueryTrace } from "../types";

export interface MonitorContextValue {
  clearTraces: () => void;
  queryState: QueryState;
  submitPrompt: (prompt: string) => Promise<void>;
  traces: QueryTrace[];
}

export const MonitorContext = createContext<MonitorContextValue | null>(
  null,
);
