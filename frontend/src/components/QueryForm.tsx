import { FormEvent, useState } from "react";

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
    const normalized = prompt.trim();

    if (normalized.length === 0) {
      setValidationError("Enter a prompt before submitting.");
      return;
    }
    if (normalized.length > 2_000) {
      setValidationError("Prompt must be 2,000 characters or fewer.");
      return;
    }

    setValidationError(null);
    await onSubmit(normalized);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/65 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="border-b border-white/5 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M5 5.5h14v10H9l-4 3v-13Z" />
              <path d="M8.5 9h7M8.5 12h4.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Ask a question</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              We check the semantic cache before generating.
            </p>
          </div>
        </div>
      </div>

      <form className="p-5 sm:p-6" onSubmit={(event) => void handleSubmit(event)}>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
          htmlFor="prompt"
        >
          Your prompt
        </label>

        <div
          className={[
            "rounded-xl border bg-slate-950/70 transition",
            "focus-within:border-sky-400/50 focus-within:ring-4 focus-within:ring-sky-400/5",
            validationError === null
              ? "border-white/10"
              : "border-rose-400/40",
          ].join(" ")}
        >
          <textarea
            id="prompt"
            name="prompt"
            rows={7}
            maxLength={2_000}
            value={prompt}
            disabled={isLoading}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (validationError !== null) {
                setValidationError(null);
              }
            }}
            aria-describedby={validationError === null ? "prompt-hint" : "prompt-error"}
            placeholder="What would you like to know?"
            className="scrollbar-thin block min-h-44 w-full resize-y rounded-xl border-0 bg-transparent px-4 py-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]"
          />
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-2.5">
            <p id="prompt-hint" className="text-xs text-slate-600">
              Clear, focused prompts produce better matches.
            </p>
            <span
              className={[
                "ml-4 shrink-0 text-xs tabular-nums",
                prompt.length > 1_800 ? "text-amber-300" : "text-slate-600",
              ].join(" ")}
            >
              {prompt.length.toLocaleString()} / 2,000
            </span>
          </div>
        </div>

        {validationError !== null && (
          <p className="mt-2 text-xs font-medium text-rose-300" id="prompt-error" role="alert">
            {validationError}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs text-slate-600">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setPrompt(example)}
                  className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-left text-xs text-slate-400 transition hover:border-sky-400/25 hover:bg-sky-400/5 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-0.5 hover:shadow-sky-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isLoading ? (
              <>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-80" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Processing
              </>
            ) : (
              <>
                Run query
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
