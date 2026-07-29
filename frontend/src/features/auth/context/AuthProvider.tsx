import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import type { ReactNode } from "react";

import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "@/shared/api/authToken";
import { isProtectedQueryKey } from "@/shared/query/queryKeys";

import { getAuthConfig, getAuthSession } from "../api/authApi";
import type { AuthSession } from "../types";
import { AuthContext } from "./AuthContext";
import type {
  AuthContextValue,
  AuthStatus,
} from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: Readonly<AuthProviderProps>): JSX.Element {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearProtectedQueries = useCallback((): void => {
    queryClient.removeQueries({
      predicate: (query) => isProtectedQueryKey(query.queryKey),
    });
  }, [queryClient]);

  const authenticate = useCallback(
    async (token: string): Promise<boolean> => {
      const normalized = token.trim();

      if (normalized === "") {
        setError("Enter an access token.");
        return false;
      }

      setAuthToken(normalized);
      setError(null);

      const response = await getAuthSession();

      if (!response.ok) {
        clearAuthToken();
        clearProtectedQueries();
        setSession(null);
        setStatus("unauthenticated");
        setError(response.error.detail ?? "The access token was rejected.");
        return false;
      }

      clearProtectedQueries();
      setSession(response.data);
      setStatus("authenticated");
      return true;
    },
    [clearProtectedQueries],
  );

  const logout = useCallback((): void => {
    clearAuthToken();
    clearProtectedQueries();
    setSession(null);
    setError(null);
    setStatus("unauthenticated");
  }, [clearProtectedQueries]);

  useEffect(() => {
    let active = true;

    async function initialize(): Promise<void> {
      const config = await getAuthConfig();

      if (!active) {
        return;
      }

      if (!config.ok) {
        setStatus("error");
        setError(
          config.error.detail ?? "Authentication status could not be loaded.",
        );
        return;
      }

      if (!config.data.authentication_required) {
        clearProtectedQueries();
        setStatus("disabled");
        return;
      }

      const storedToken = getAuthToken();

      if (storedToken === null) {
        setStatus("unauthenticated");
        return;
      }

      await authenticate(storedToken);
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [authenticate, clearProtectedQueries]);

  const value = useMemo<AuthContextValue>(
    () => ({ authenticate, error, logout, session, status }),
    [authenticate, error, logout, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}