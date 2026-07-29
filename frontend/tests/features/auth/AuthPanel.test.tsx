import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthPanel } from "@/features/auth/components/AuthPanel";
import { useAuth } from "@/features/auth/hooks/useAuth";

describe("AuthPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("announces that the access policy is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => false),
      error: null,
      logout: vi.fn(),
      session: null,
      status: "loading",
    });

    render(<AuthPanel />);

    expect(screen.getByText("Checking access policy…")).toBeTruthy();
  });

  it("separates authenticated session details with middle dots", () => {
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => true),
      error: null,
      logout: vi.fn(),
      session: {
        name: "Ada",
        role: "admin",
        namespaces: ["alpha", "beta"],
      },
      status: "authenticated",
    });

    render(<AuthPanel />);

    expect(screen.getByText("Ada · admin · alpha, beta")).toBeTruthy();
  });

  it("announces when authentication is being verified", async () => {
    let resolveAuthentication: ((accepted: boolean) => void) | undefined;
    const authenticate = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAuthentication = resolve;
        }),
    );
    vi.mocked(useAuth).mockReturnValue({
      authenticate,
      error: null,
      logout: vi.fn(),
      session: null,
      status: "unauthenticated",
    });
    render(<AuthPanel />);

    fireEvent.change(screen.getByLabelText("Access token"), {
      target: { value: "test-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Authenticate" }));

    expect(
      (
        screen.getByRole("button", {
          name: "Verifying…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      if (resolveAuthentication === undefined) {
        throw new Error("Authentication promise was not created");
      }
      resolveAuthentication(false);
    });
  });
});
