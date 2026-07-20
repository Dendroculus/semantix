import { Outlet } from "react-router-dom";

import { AuthPanel } from "@/features/auth/components/AuthPanel";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCacheControl } from "@/features/cache/hooks/useCacheControl";
import { Alert } from "@/shared/components/ui";
import { Navbar } from "../navigation/Navbar";
import {
  AppProviders,
  WorkspaceProviders,
} from "../providers/AppProviders";

function Workspace(): JSX.Element {
  const { clearControlError, controlError } = useCacheControl();

  return (
    <>
      {controlError !== null && (
        <Alert
          action={
            <button
              className="ui-label text-(--text-muted) focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-(--gold)"
              type="button"
              onClick={clearControlError}
            >
              Dismiss
            </button>
          }
          className="font-data mt-5 border-l border-(--coral) pl-4 text-[11px] text-(--coral)"
          role="alert"
          tone="error"
        >
          <span>{controlError}</span>
        </Alert>
      )}

      <main className="py-10 sm:py-12" id="main-content">
        <Outlet />
      </main>
    </>
  );
}

function AppShell(): JSX.Element {
  const { status } = useAuth();
  const canAccessWorkspace =
    status === "disabled" || status === "authenticated";

  return (
    <div className="min-h-screen overflow-x-clip bg-(--ink) px-4 text-(--text) sm:px-8">
      <a
        className="ui-label fixed left-4 top-3 z-50 -translate-y-20 bg-(--gold) px-3 py-2 text-(--ink) focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <div className="mx-auto max-w-6xl">
        <Navbar />
        <AuthPanel />

        {canAccessWorkspace ? (
          <WorkspaceProviders>
            <Workspace />
          </WorkspaceProviders>
        ) : (
          <main className="py-10 sm:py-12" id="main-content">
            <output
            aria-live="polite"
            className="font-data text-[11px] text-(--text-muted)"
          >
            Authenticate to load Semantix workspaces.
          </output>
          </main>
        )}
      </div>
    </div>
  );
}

export function AppLayout(): JSX.Element {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
