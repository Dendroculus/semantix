import {
  lazy,
  Suspense,
  type JSX,
} from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  Link,
  Route,
  Routes,
} from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppBrowserRouter } from "@/app/router/AppBrowserRouter";
import { RouteLoader } from "@/app/router/RouteLoader";
import { deferred } from "../features/support";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("AppBrowserRouter", () => {
  it("commits navigation to the workspace loader while a lazy route resolves", async () => {
    const benchmarkModule = deferred<{
      default: () => JSX.Element;
    }>();
    const LazyBenchmarkPage = lazy(() => benchmarkModule.promise);

    window.history.replaceState(null, "", "/");
    render(
      <AppBrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Link to="/benchmarks">Benchmarks</Link>
                <p>Monitor content</p>
              </>
            }
          />
          <Route
            path="/benchmarks"
            element={
              <Suspense fallback={<RouteLoader />}>
                <LazyBenchmarkPage />
              </Suspense>
            }
          />
        </Routes>
      </AppBrowserRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Benchmarks" }));

    expect(window.location.pathname).toBe("/benchmarks");
    expect(screen.getByLabelText("Loading workspace")).toBeTruthy();
    expect(screen.queryByText("Monitor content")).toBeNull();
    expect(document.querySelector(".animate-spin")).toBeNull();
    expect(
      document.querySelector('[data-workspace-skeleton="benchmark"]'),
    ).toBeTruthy();
    expect(
      document.querySelectorAll("[data-skeleton-route-control]"),
    ).toHaveLength(6);

    await act(async () => {
      benchmarkModule.resolve({
        default: () => <h1>Benchmark laboratory</h1>,
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: "Benchmark laboratory",
      }),
    ).toBeTruthy();
  });
});
