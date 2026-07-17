import type { ReactNode } from "react";

import { CacheControlProvider } from "../../features/cache/context/CacheControlContext";
import { MonitorProvider } from "../../features/monitor/context/MonitorContext";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({
  children,
}: AppProvidersProps): JSX.Element {
  return (
    <CacheControlProvider>
      <MonitorProvider>{children}</MonitorProvider>
    </CacheControlProvider>
  );
}
