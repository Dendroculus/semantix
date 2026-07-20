import { useState } from "react";

import { useAuth } from "../hooks/useAuth";

export function AuthPanel(): JSX.Element | null {
  const { authenticate, error, logout, session, status } = useAuth();
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "disabled") {
    return null;
  }

  if (status === "loading") {
    return (
      <output
        aria-live="polite"
        className="font-data mt-4 block text-[10px] text-(--text-muted)"
      >
        Checking access policyÃ¢â‚¬Â¦
      </output>
    );
  }

  if (status === "authenticated" && session !== null) {
    return (
      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-(--hairline) bg-(--surface) px-4 py-3">
        <div>
          <p className="ui-label text-(--text-faint)">Authenticated access</p>
          <p className="font-data mt-1 text-[10px] text-(--text-soft)">
            {session.name} Ã‚Â· {session.role} Ã‚Â· {session.namespaces.join(", ")}
          </p>
        </div>
        <button
          className="ui-label border border-(--hairline) px-3 py-2 text-(--text-muted) hover:border-(--gold) hover:text-(--gold) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gold)"
          type="button"
          onClick={logout}
        >
          Sign out
        </button>
      </section>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    const accepted = await authenticate(token);
    setIsSubmitting(false);
    if (accepted) {
      setToken("");
    }
  }

  return (
    <section className="mt-4 border border-(--hairline) bg-(--surface) p-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={submit}>
        <label className="min-w-0 flex-1">
          <span className="ui-label text-(--text-faint)">Access token</span>
          <input
            autoComplete="off"
            className="font-data mt-2 w-full border border-(--hairline) bg-(--ink) px-3 py-2 text-[11px] text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gold)"
            name="access-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <button
          className="ui-label border border-(--gold) px-4 py-2 text-(--gold) disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "VerifyingÃ¢â‚¬Â¦" : "Authenticate"}
        </button>
      </form>
      {error !== null && (
        <p className="font-data mt-3 text-[10px] text-(--coral)" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
