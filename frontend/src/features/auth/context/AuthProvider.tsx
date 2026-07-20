import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "@/shared/api/authToken";

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
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async (token: string): Promise<boolean> => {
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
      setSession(null);
      setStatus("unauthenticated");
      setError(response.error.detail ?? "The access token was rejected.");
      return false;
    }

    setSession(response.data);
    setStatus("authenticated");
    return true;
  }, []);

  const logout = useCallback((): void => {
    clearAuthToken();
    setSession(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

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
  }, [authenticate]);

  const value = useMemo<AuthContextValue>(
    () => ({ authenticate, error, logout, session, status }),
    [authenticate, error, logout, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}