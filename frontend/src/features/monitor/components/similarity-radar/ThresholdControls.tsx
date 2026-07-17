interface ThresholdControlsProps {
  appliedThreshold: number;
  isApplyingThreshold: boolean;
  onThresholdApply: (threshold: number) => void;
  onThresholdChange: (threshold: number) => void;
  threshold: number;
}

export function ThresholdControls({
  appliedThreshold,
  isApplyingThreshold,
  onThresholdApply,
  onThresholdChange,
  threshold,
}: ThresholdControlsProps): JSX.Element {
  const hasPendingThreshold =
    Math.abs(threshold - appliedThreshold) >= 0.001;

  return (
    <div className="mt-7">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <label
          className="ui-label text-[var(--text-muted)]"
          htmlFor="projection-threshold"
        >
          Projection threshold
        </label>
        <div className="font-data flex gap-4 text-[10px]">
          <span className="text-[var(--teal)]">
            Preview {threshold.toFixed(2)}
          </span>
          <span className="text-[var(--gold)]">
            Backend applied {appliedThreshold.toFixed(2)}
          </span>
        </div>
      </div>

      <input
        aria-describedby="threshold-note"
        className="threshold-range"
        id="projection-threshold"
        max="1"
        min="0"
        step="0.01"
        type="range"
        value={threshold}
        onChange={(event) =>
          onThresholdChange(Number(event.target.value))
        }
      />

      <div className="font-data mt-3 flex justify-between text-[10px] text-[var(--text-faint)]">
        <span>0.00 / permissive</span>
        <span>1.00 / exact</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="ui-label border border-[var(--gold)] px-3 py-2 text-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={
            !hasPendingThreshold || isApplyingThreshold
          }
          type="button"
          onClick={() => onThresholdApply(threshold)}
        >
          {isApplyingThreshold ? "Applying" : "Apply to cache"}
        </button>
        <button
          className="ui-label border-b border-[var(--teal)] px-1 py-2 text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={
            !hasPendingThreshold || isApplyingThreshold
          }
          type="button"
          onClick={() => onThresholdChange(appliedThreshold)}
        >
          Reset preview
        </button>
      </div>

      <p
        className="mt-5 max-w-xl text-xs leading-5 text-[var(--text-muted)]"
        id="threshold-note"
      >
        Every dot sits at its real similarity score. Vertical position
        only prevents overlap. Hover, focus, or select a trace to inspect
        its prompt and cache decision. Moving the slider previews which
        scored traces would qualify; it does not change backend behavior
        until you select Apply to cache.
      </p>
    </div>
  );
}
