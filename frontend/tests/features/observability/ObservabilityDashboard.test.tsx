import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getRuntimeMetrics } from "@/features/observability/api/metricsApi";
import { ObservabilityDashboard } from "@/features/observability/components/ObservabilityDashboard";
import { deferred } from "../support";

vi.mock("@/features/observability/api/metricsApi");

const metrics = {
  observed_at: "2026-07-19T08:00:00Z",
  uptime_seconds: 3_900,
  request_count: 12,
  error_count: 1,
  cache_hits: 7,
  cache_misses: 4,
  provider_calls: 4,
  in_flight_coalesced_requests: 2,
  average_latency_ms: 25.5,
  p95_latency_ms: 80.25,
  latency_sample_size: 12,
  cache_size: 5,
  evictions: 3,
  expirations: 2,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ObservabilityDashboard", () => {
  it("uses a skeleton before rendering live metrics", async () => {
    let resolveMetrics:
      | ((value: Awaited<ReturnType<typeof getRuntimeMetrics>>) => void)
      | undefined;
    vi.mocked(getRuntimeMetrics).mockReturnValue(
      new Promise((resolve) => {
        resolveMetrics = resolve;
      }),
    );

    render(<ObservabilityDashboard />);

    expect(
      screen.getByLabelText("Loading runtime metrics"),
    ).toBeTruthy();

    await act(async () => {
      resolveMetrics?.({ ok: true, data: metrics });
    });

    expect(await screen.findAllByText("12")).toHaveLength(2);
    expect(screen.getByText("25.5 ms")).toBeTruthy();
    expect(screen.getByText("80.3 ms")).toBeTruthy();
    expect(
      screen.queryByLabelText("Loading runtime metrics"),
    ).toBeNull();

    const cacheGrid = screen.getByText("Cache").closest("section")
      ?.querySelector("dl");
    expect(cacheGrid?.children).toHaveLength(5);
    expect(cacheGrid?.className).toContain("flex-wrap");
    expect(cacheGrid?.firstElementChild?.className).toContain("grow");
    expect(cacheGrid?.firstElementChild?.className).toContain(
      "basis-56",
    );
  });

  it("renders an endpoint error without simulated fallback data", async () => {
    vi.mocked(getRuntimeMetrics).mockResolvedValue({
      ok: false,
      error: {
        code: "network_error",
        detail: "Backend unavailable",
        status: null,
      },
    });

    render(<ObservabilityDashboard />);

    expect(await screen.findByText("Backend unavailable")).toBeTruthy();
    expect(screen.queryByText("25.5 ms")).toBeNull();
  });

  it("ignores an older response that resolves after a newer request", async () => {
    const older =
      deferred<Awaited<ReturnType<typeof getRuntimeMetrics>>>();
    const newer =
      deferred<Awaited<ReturnType<typeof getRuntimeMetrics>>>();
    vi.mocked(getRuntimeMetrics)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    render(
      <StrictMode>
        <ObservabilityDashboard />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(getRuntimeMetrics).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      newer.resolve({
        ok: true,
        data: { ...metrics, request_count: 91 },
      });
    });

    const requestMetric = screen.getByText("Requests").closest("div");
    expect(requestMetric?.textContent).toContain("91");

    await act(async () => {
      older.resolve({ ok: true, data: metrics });
    });

    expect(requestMetric?.textContent).toContain("91");
  });

  it("disables and coalesces manual refresh while a request is active", async () => {
    vi.mocked(getRuntimeMetrics).mockResolvedValueOnce({
      ok: true,
      data: metrics,
    });
    const refresh =
      deferred<Awaited<ReturnType<typeof getRuntimeMetrics>>>();
    vi.mocked(getRuntimeMetrics).mockReturnValueOnce(refresh.promise);

    render(<ObservabilityDashboard />);
    await screen.findByText("25.5 ms");

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Refresh metrics",
    });
    fireEvent.click(button);

    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(getRuntimeMetrics).toHaveBeenCalledTimes(2);

    await act(async () => {
      refresh.resolve({
        ok: true,
        data: { ...metrics, request_count: 13 },
      });
    });
  });
});
