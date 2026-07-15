import { FormEvent, useState } from "react";

interface QueryFormProps {
  isLoading: boolean;
  onSubmit: (prompt: string) => Promise<void>;
}

export function QueryForm({ isLoading, onSubmit }: QueryFormProps): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = prompt.trim();
    if (normalized.length === 0) {
      setValidationError("Enter a prompt.");
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
    <form onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor="prompt">Prompt</label>
      <textarea
        id="prompt"
        name="prompt"
        rows={6}
        maxLength={2_000}
        value={prompt}
        disabled={isLoading}
        onChange={(event) => setPrompt(event.target.value)}
        aria-describedby={validationError === null ? undefined : "prompt-error"}
      />
      {validationError !== null && <p id="prompt-error" role="alert">{validationError}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Processing..." : "Submit"}
      </button>
    </form>
  );
}
