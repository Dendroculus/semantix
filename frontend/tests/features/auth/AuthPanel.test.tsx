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
    vi.useRealTimers();
  });

  it("renders no authentication UI when authentication is disabled", () => {
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => false),
      error: null,
      lockedUntil: null,
      logout: vi.fn(),
      session: null,
      status: "disabled",
    });

    const { container } = render(<AuthPanel />);

    expect(container.firstChild).toBeNull();
  });

  it("keeps a stable authentication gate while access policy loads", () => {
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => false),
      error: null,
      lockedUntil: null,
      logout: vi.fn(),
      session: null,
      status: "loading",
    });

    render(<AuthPanel />);

    expect(
      screen.getByRole("heading", { name: "Authentication required" }),
    ).toBeTruthy();
    expect(screen.getByText("Checking access policy…")).toBeTruthy();
    expect(
      (screen.getByLabelText("Access token") as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("shows principal, role, scope, and sign-out in the access bar", () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => true),
      error: null,
      lockedUntil: null,
      logout,
      session: {
        name: "Ada",
        role: "admin",
        namespaces: ["alpha", "beta"],
      },
      status: "authenticated",
    });

    render(<AuthPanel />);

    expect(screen.getByText("Authenticated access")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getByText("Scope: alpha, beta")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("updates only inline feedback after a rejected token", () => {
    const authenticate = vi.fn(async () => false);
    vi.mocked(useAuth).mockReturnValue({
      authenticate,
      error: null,
      lockedUntil: null,
      logout: vi.fn(),
      session: null,
      status: "unauthenticated",
    });
    const { rerender } = render(<AuthPanel />);
    const heading = screen.getByRole("heading", {
      name: "Authentication required",
    });
    const gate = heading.closest("section");

    vi.mocked(useAuth).mockReturnValue({
      authenticate,
      error: "The access token was rejected.",
      lockedUntil: null,
      logout: vi.fn(),
      session: null,
      status: "unauthenticated",
    });
    rerender(<AuthPanel />);

    expect(screen.getByRole("alert").textContent).toBe(
      "The access token was rejected.",
    );
    expect(
      screen
        .getByRole("heading", { name: "Authentication required" })
        .closest("section"),
    ).toBe(gate);
    expect(screen.getByLabelText("Access token")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Authenticate" })).toBeTruthy();
  });

  it("disables controls and counts down from the absolute lock timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T05:00:00Z"));
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => false),
      error: "Too many failed authentication attempts.",
      lockedUntil: Date.now() + 30_000,
      logout: vi.fn(),
      session: null,
      status: "unauthenticated",
    });

    render(<AuthPanel />);

    const input = screen.getByLabelText("Access token") as HTMLInputElement;
    const button = screen.getByRole("button", {
      name: "Authenticate",
    }) as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Try again in 00:30.")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("Try again in 00:29.")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(screen.queryByText(/Try again in/)).toBeNull();
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
      lockedUntil: null,
      logout: vi.fn(),
      session: null,
      status: "unauthenticated",
    });
    render(<AuthPanel />);

    const tokenInput = screen.getByLabelText("Access token");
    expect((tokenInput as HTMLInputElement).type).toBe("password");
    fireEvent.change(tokenInput, {
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
