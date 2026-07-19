import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getRuntimeMetrics } from "@/features/observability/api/metricsApi";
import { ObservabilityDashboard } from "@/features/observability/components/ObservabilityDashboard";

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
});
