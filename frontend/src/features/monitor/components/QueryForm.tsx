import { useState } from "react";
import type { FormEvent } from "react";

interface QueryFormProps {
  isLoading: boolean;
  onSubmit: (prompt: string) => Promise<void>;
}

const EXAMPLE_PROMPTS = [
  "Explain semantic caching in simple terms",
  "How does cosine similarity work?",
];

export function QueryForm({ isLoading, onSubmit }: QueryFormProps): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();

    if (normalizedPrompt.length === 0) {
      setValidationError("A blank prompt has no semantic neighborhood.");
      return;
    }

    if (normalizedPrompt.length > 2_000) {
      setValidationError("Keep the prompt at or below 2,000 characters.");
      return;
    }

    setValidationError(null);
    await onSubmit(normalizedPrompt);
  }

  return (
    <section aria-labelledby="query-heading">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl italic" id="query-heading">
            Probe the cache
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Each prompt is embedded, compared with the nearest stored vector,
            then either reused or sent upstream.
          </p>
        </div>

        <p className="ui-label text-[var(--text-faint)]">Max 2,000 chars</p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label className="ui-label mb-2 block text-[var(--text-muted)]" htmlFor="prompt">
          Query text
        </label>

        <textarea
          id="prompt"
          aria-describedby={validationError === null ? "prompt-note" : "prompt-error"}
          className="scrollbar-thin block min-h-36 w-full resize-y border border-[var(--hairline)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isLoading}
          maxLength={2_000}
          name="prompt"
          placeholder="Describe the thing you want the cache to recognize."
          rows={6}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setValidationError(null);
          }}
        />

        <div className="font-data mt-2 flex items-start justify-between gap-4 text-[10px] text-[var(--text-faint)]">
          <p id="prompt-note">Focused wording makes the neighborhood easier to inspect.</p>
          <span className="shrink-0 tabular-nums">{prompt.length} / 2000</span>
        </div>

        {validationError !== null && (
          <p className="font-data mt-3 text-[11px] text-[var(--coral)]" id="prompt-error" role="alert">
            {validationError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-label mb-2 text-[var(--text-faint)]">Sample probes</p>
            <div className="flex flex-col items-start gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  className="text-left text-xs text-[var(--teal)] underline decoration-[rgba(91,156,148,0.35)] underline-offset-4 transition-colors hover:text-[var(--text)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--teal)] disabled:opacity-50"
                  disabled={isLoading}
                  type="button"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <button
            className="ui-label w-full border border-[var(--gold)] bg-[var(--gold)] px-5 py-3 text-[var(--ink)] transition-colors hover:bg-transparent hover:text-[var(--gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Embedding + lookup" : "Run query"}
          </button>
        </div>
      </form>
    </section>
  );
}
