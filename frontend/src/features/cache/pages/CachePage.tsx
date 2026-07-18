import {
  CacheInspector,
  type CacheMutation,
} from "../components/CacheInspector";
import { useCacheControl } from "../hooks/useCacheControl";
import { useMonitor } from "@/features/monitor/hooks/useMonitor";

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
      <header className="mb-9">
        <p className="ui-label text-(--gold)">Storage controls</p>
        <h1 className="font-display mt-1 text-3xl italic">Cache inspector</h1>
        <p className="mt-3 max-w-3xl text-sm/6  text-(--text-muted)">
          Search safe entry metadata, inspect reuse activity and expiry, or
          remove stale responses without exposing stored embeddings.
        </p>
      </header>

      <CacheInspector
        refreshKey={0}
        onMutation={(mutation) => void handleMutation(mutation)}
      />
    </>
  );
}
