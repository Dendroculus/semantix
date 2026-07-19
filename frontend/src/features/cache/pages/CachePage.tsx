import {
  CacheInspector,
  type CacheMutation,
} from "../components/CacheInspector";
import { useCacheControl } from "../hooks/useCacheControl";
import { useMonitor } from "@/features/monitor/hooks/useMonitor";
import { PageHeader } from "@/shared/components/ui";

export function CachePage(): JSX.Element {
  const { refreshCacheState } = useCacheControl();
  const { clearTraces } = useMonitor();

  async function handleMutation(mutation: CacheMutation): Promise<void> {
    if (mutation === "clear") {
      clearTraces();
    }
    await refreshCacheState(false);
  }

  return (
    <>
      <PageHeader
        className="mb-9"
        description="Search safe entry metadata, inspect reuse activity and expiry, or remove stale responses without exposing stored embeddings."
        eyebrow="Storage controls"
        title="Cache inspector"
      />

      <CacheInspector
        onMutation={(mutation) => void handleMutation(mutation)}
      />
    </>
  );
}
