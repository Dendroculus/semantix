import { Outlet } from "react-router-dom";

import { useCacheControl } from "@/features/cache/hooks/useCacheControl";
import { Navbar } from "../navigation/Navbar";
import { AppProviders } from "../providers/AppProviders";

function AppShell(): JSX.Element {
  const { clearControlError, controlError } = useCacheControl();

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

        {controlError !== null && (
          <div
            className="font-data mt-5 flex flex-wrap items-center justify-between gap-4 border-l border-(--coral) pl-4 text-[11px] text-(--coral)"
            role="alert"
          >
            <span>{controlError}</span>
            <button
              className="ui-label text-(--text-muted) focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-(--gold)"
              type="button"
              onClick={clearControlError}
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="py-10 sm:py-12" id="main-content">
          <Outlet />
        </main>
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
