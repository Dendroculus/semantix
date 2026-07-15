import { act, renderHook } from "@testing-library/react";
import type { MockedFunction } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuery } from "../src/hooks/useQuery";

describe("useQuery", () => {
  let fetchMock: MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a successful query response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: "Cached answer",
          cache_hit: true,
          similarity_score: 0.97,
          latency_ms: 4.2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useQuery());
    await act(async () => {
      expect(await result.current.submit("Hello")).toBe(true);
    });
    expect(result.current.state.status).toBe("success");
    if (result.current.state.status === "success") {
      expect(result.current.state.data.cache_hit).toBe(true);
    }
  });

  it("stores a typed API error", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "rate_limit_exceeded", detail: "Try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useQuery());
    await act(async () => {
      expect(await result.current.submit("Hello")).toBe(false);
    });
    expect(result.current.state.status).toBe("error");
    if (result.current.state.status === "error") {
      expect(result.current.state.error.code).toBe("rate_limit_exceeded");
    }
  });
});
