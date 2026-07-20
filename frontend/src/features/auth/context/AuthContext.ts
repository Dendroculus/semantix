import { createContext } from "react";

import type { AuthSession } from "../types";

export type AuthStatus =
  | "loading"
  | "disabled"
  | "unauthenticated"
  | "authenticated"
  | "error";

export interface AuthContextValue {
  authenticate: (token: string) => Promise<boolean>;
  error: string | null;
  logout: () => void;
  session: AuthSession | null;
  status: AuthStatus;
}

export const AuthContext = createContext<AuthContextValue | null>(null);