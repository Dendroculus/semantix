import type { ReactNode } from "react";

import { AuthProvider } from "@/features/auth/context/AuthProvider";
import { CacheControlProvider } from "@/features/cache/context/CacheControlContext";
import { MonitorProvider } from "@/features/monitor/context/MonitorContext";

interface ProviderProps {
  children: ReactNode;
}

export function AppProviders({ children }: Readonly<ProviderProps>): JSX.Element {
  return <AuthProvider>{children}</AuthProvider>;
}

export function WorkspaceProviders({
  children,
}: Readonly<ProviderProps>): JSX.Element {
  return (
    <CacheControlProvider>
      <MonitorProvider>{children}</MonitorProvider>
    </CacheControlProvider>
  );
}
