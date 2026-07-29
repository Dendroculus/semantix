import { useQuery } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useContext, type JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QueryTestProvider } from "../QueryTestProvider";
import { createTestQueryClient } from "../queryClient";
import {
  getAuthConfig,
  getAuthSession,
} from "@/features/auth/api/authApi";
import {
  AuthContext,
} from "@/features/auth/context/AuthContext";
import { AuthProvider } from "@/features/auth/context/AuthProvider";
import {
  benchmarkDatasetKeys,
  cacheEntryKeys,
  runtimeMetricsKeys,
} from "@/shared/query/queryKeys";

function ProtectedDataProbe(): JSX.Element {
  const auth = useContext(AuthContext);
  if (auth === null) {
    throw new Error("Auth context is unavailable");
  }
  const protectedQuery = useQuery({
    queryKey: runtimeMetricsKeys.live(),
    queryFn: async () => "replacement metrics",
    enabled: false,
  });

  return (
    <>
      <output aria-label="Authentication status">{auth.status}</output>
      <output aria-label="Protected metrics">
        {protectedQuery.data ?? "empty"}
      </output>
      <button type="button" onClick={async () => auth.authenticate("new-token")}>
        Authenticate test identity
      </button>
      <button type="button" onClick={auth.logout}>
        Logout test identity
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("authentication query isolation", () => {
  it("removes protected data when identity changes and on logout", async () => {
    vi.mocked(getAuthConfig).mockResolvedValue({
      ok: true,
      data: { authentication_required: true },
    });
    vi.mocked(getAuthSession).mockResolvedValue({
      ok: true,
      data: {
        name: "new-principal",
        role: "admin",
        namespaces: ["*"],
      },
    });
    const queryClient = createTestQueryClient();
    const cacheKey = cacheEntryKeys.list({
      offset: 0,
      limit: 10,
      namespace: "",
      search: "",
      sort: "newest",
    });
    queryClient.setQueryData(runtimeMetricsKeys.live(), "old metrics");
    queryClient.setQueryData(cacheKey, "old cache entries");
    queryClient.setQueryData(
      benchmarkDatasetKeys.catalog(),
      "old datasets",
    );
    queryClient.setQueryData(["public-preference"], "preserve me");

    render(
      <QueryTestProvider client={queryClient}>
        <AuthProvider>
          <ProtectedDataProbe />
        </AuthProvider>
      </QueryTestProvider>,
    );
    expect(screen.getByLabelText("Protected metrics").textContent).toBe(
      "old metrics",
    );
    await screen.findByText("unauthenticated");

    fireEvent.click(screen.getByRole("button", { name: "Authenticate test identity" }));

    await screen.findByText("authenticated");
    expect(screen.getByLabelText("Protected metrics").textContent).toBe(
      "empty",
    );
    expect(queryClient.getQueryData(cacheKey)).toBeUndefined();
    expect(
      queryClient.getQueryData(benchmarkDatasetKeys.catalog()),
    ).toBeUndefined();
    expect(queryClient.getQueryData(["public-preference"])).toBe(
      "preserve me",
    );

    act(() => {
      queryClient.setQueryData(runtimeMetricsKeys.live(), "second identity");
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Protected metrics").textContent).toBe(
        "second identity",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Logout test identity" }));
    await screen.findByText("unauthenticated");
    expect(screen.getByLabelText("Protected metrics").textContent).toBe(
      "empty",
    );
  });

  it("removes protected data when authentication becomes disabled", async () => {
    vi.mocked(getAuthConfig).mockResolvedValue({
      ok: true,
      data: { authentication_required: false },
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(runtimeMetricsKeys.live(), "old metrics");

    render(
      <QueryTestProvider client={queryClient}>
        <AuthProvider>
          <ProtectedDataProbe />
        </AuthProvider>
      </QueryTestProvider>,
    );

    await screen.findByText("disabled");
    expect(screen.getByLabelText("Protected metrics").textContent).toBe(
      "empty",
    );
    expect(
      queryClient.getQueryData(runtimeMetricsKeys.live()),
    ).toBeUndefined();
  });
});
