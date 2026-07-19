import { FieldMetrics } from "../components/FieldMetrics";
import { QueryForm } from "../components/QueryForm";
import { QueryLog } from "../components/QueryLog";
import { ResponseCard } from "../components/ResponseCard";
import { ResponseSkeleton } from "../components/ResponseSkeleton";
import { SimilarityRadar } from "../components/similarity-radar/SimilarityRadar";
import { useCacheControl } from "@/features/cache/hooks/useCacheControl";
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
      <section className="mb-12 border-b border-(--hairline) pb-10">
        <QueryForm
          isLoading={queryState.status === "loading"}
          onSubmit={submitPrompt}
        />

        {queryState.status === "loading" && (
          <div className="mt-8">
            <ResponseSkeleton />
          </div>
        )}

        {queryState.status === "error" && (
          <div
            className="mt-6 border-l-2 border-(--coral) bg-[rgba(194,96,74,0.06)] px-4 py-3"
            role="alert"
          >
            <p className="ui-label text-(--coral)">Query failed</p>
            <p className="font-data mt-1 text-[11px]/5 text-(--text-soft)">
              {queryState.error.detail ?? "The provider returned no detail."}
            </p>
          </div>
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
