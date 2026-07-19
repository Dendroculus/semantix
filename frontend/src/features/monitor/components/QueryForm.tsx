import { useState, type FormEvent } from 'react';

import { Button } from '@/shared/components/ui';
import { formatCount } from '@/shared/lib/formatters';

interface QueryFormProps {
  isLoading: boolean;
  onSubmit: (prompt: string) => Promise<void>;
}

const EXAMPLE_PROMPTS = [
  'Explain semantic caching in simple terms',
  'How does cosine similarity work?',
];

const MAX_PROMPT_LENGTH = 2_000;
const MAX_PROMPT_LENGTH_LABEL = formatCount(MAX_PROMPT_LENGTH);

export function QueryForm({
  isLoading,
  onSubmit,
}: Readonly<QueryFormProps>): JSX.Element {
  const [prompt, setPrompt] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const normalizedPrompt = prompt.trim();

    if (normalizedPrompt.length === 0) {
      setValidationError('A blank prompt has no semantic neighborhood.');
      return;
    }

    if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
      setValidationError(
        `Keep the prompt at or below ${MAX_PROMPT_LENGTH_LABEL} characters.`,
      );
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

          <p className="mt-2 max-w-2xl text-sm/6 text-(--text-muted)">
            Each prompt is embedded, compared with the nearest stored vector,
            then either reused or sent upstream.
          </p>
        </div>

        <p className="ui-label text-(--text-faint)">
          Max {MAX_PROMPT_LENGTH_LABEL} chars
        </p>
      </div>

      <form
        aria-busy={isLoading}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label
          className="ui-label mb-2 block text-(--text-muted)"
          htmlFor="prompt"
        >
          Query text
        </label>

        <textarea
          id="prompt"
          aria-describedby={
            validationError === null ? 'prompt-note' : 'prompt-error'
          }
          className="scrollbar-thin block min-h-36 w-full resize-y border border-(--hairline) bg-(--surface) p-4 text-sm/6 text-(--text) outline-none transition-colors placeholder:text-(--text-faint) hover:border-(--text-faint) focus-visible:border-(--gold) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gold) disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isLoading}
          maxLength={MAX_PROMPT_LENGTH}
          name="prompt"
          placeholder="Describe the thing you want the cache to recognize."
          rows={6}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setValidationError(null);
          }}
        />

        <div className="font-data mt-2 flex items-start justify-between gap-4 text-[10px] text-(--text-faint)">
          <p id="prompt-note">
            Focused wording makes the neighborhood easier to inspect.
          </p>

          <span className="shrink-0 tabular-nums">
            {prompt.length} / {MAX_PROMPT_LENGTH_LABEL}
          </span>
        </div>

        {validationError !== null && (
          <p
            className="font-data mt-3 border-l-2 border-(--coral) pl-3 text-[11px]/5 text-(--coral)"
            id="prompt-error"
            role="alert"
          >
            {validationError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-label mb-2 text-(--text-faint)">Sample probes</p>

            <div className="flex flex-col items-start gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  className="min-h-8 text-left text-xs text-(--teal) underline decoration-[rgba(91,156,148,0.35)] underline-offset-4 transition-colors hover:text-(--text) focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-(--teal) active:translate-y-px disabled:opacity-50"
                  disabled={isLoading}
                  type="button"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full disabled:opacity-55 sm:w-auto"
            disabled={isLoading}
            type="submit"
            variant="primary"
          >
            {isLoading ? 'Embedding + lookup…' : 'Run query'}
          </Button>
        </div>
      </form>
    </section>
  );
}
