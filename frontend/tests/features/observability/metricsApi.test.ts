import type { MockedFunction } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeMetrics } from "@/features/observability/api/metricsApi";

const metricsPayload = {
  observed_at: "2026-07-19T08:00:00Z",
  uptime_seconds: 120,
  request_count: 10,
  error_count: 1,
  cache_hits: 6,
  cache_misses: 3,
  provider_calls: 3,
  in_flight_coalesced_requests: 0,
  average_latency_ms: 42.5,
  p95_latency_ms: 90,
  latency_sample_size: 10,
  cache_size: 4,
  evictions: 2,
  expirations: 1,
};

describe("runtime metrics API", () => {
  let fetchMock: MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests and decodes runtime metrics", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(metricsPayload), { status: 200 }),
    );

    const result = await getRuntimeMetrics();

    expect(result).toEqual({ ok: true, data: metricsPayload });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/metrics"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects negative or malformed counters", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ ...metricsPayload, provider_calls: -1 }),
        { status: 200 },
      ),
    );

    const result = await getRuntimeMetrics();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
    }
  });
});
