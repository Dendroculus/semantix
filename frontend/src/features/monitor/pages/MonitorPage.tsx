import { FieldMetrics } from "../components/FieldMetrics";
import { QueryForm } from "../components/QueryForm";
import { QueryLog } from "../components/QueryLog";
import { ResponseCard } from "../components/ResponseCard";
import { SimilarityRadar } from "../components/similarity-radar/SimilarityRadar";
import { useCacheControl } from "../../cache/hooks/useCacheControl";
import { useMonitor } from "../hooks/useMonitor";

export function MonitorPage(): JSX.Element {
  const {
    appliedThreshold,
    cacheStats,
    commitThreshold,
    isApplyingThreshold,
    previewThreshold,
    setPreviewThreshold,
  } = useCacheControl();
  const { queryState, submitPrompt, traces } = useMonitor();

  return (
    <>
      <section className="mb-12 border-b border-[var(--hairline)] pb-10">
        <QueryForm
          isLoading={queryState.status === "loading"}
          onSubmit={submitPrompt}
        />

        {queryState.status === "error" && (
          <p
            className="font-data mt-4 text-[11px] text-[var(--coral)]"
            role="alert"
          >
            QUERY FAILED /{" "}
            {queryState.error.detail ?? "THE PROVIDER RETURNED NO DETAIL"}
          </p>
        )}

        {queryState.status === "success" && (
          <div className="mt-8">
            <ResponseCard result={queryState.data} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-14 min-[760px]:grid-cols-[minmax(280px,3fr)_minmax(0,2fr)]">
        <FieldMetrics
          cacheStats={cacheStats}
          threshold={previewThreshold}
          traces={traces}
        />
        <SimilarityRadar
          appliedThreshold={appliedThreshold}
          isApplyingThreshold={isApplyingThreshold}
          traces={traces}
          threshold={previewThreshold}
          onThresholdApply={(value) => void commitThreshold(value)}
          onThresholdChange={setPreviewThreshold}
        />
      </div>

      <QueryLog traces={traces} threshold={previewThreshold} />
    </>
  );
}
