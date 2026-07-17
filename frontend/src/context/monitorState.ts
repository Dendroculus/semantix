import { createContext } from "react";

import type { QueryState } from "../types/api";
import type { QueryTrace } from "../types/dashboard";

export interface MonitorContextValue {
  clearTraces: () => void;
  queryState: QueryState;
  submitPrompt: (prompt: string) => Promise<void>;
  traces: QueryTrace[];
}

export const MonitorContext = createContext<MonitorContextValue | null>(
  null,
);
