import { CacheInspectorControls } from "./cache-inspector/CacheInspectorControls";
import { CacheInspectorResults } from "./cache-inspector/CacheInspectorResults";
import {
  useCacheInspector,
  type CacheMutation,
} from "./cache-inspector/useCacheInspector";

export type { CacheMutation };

interface CacheInspectorProps {
  refreshKey: number;
  onMutation: (mutation: CacheMutation) => void;
}

export function CacheInspector({
  refreshKey,
  onMutation,
}: CacheInspectorProps): JSX.Element {
  const inspector = useCacheInspector({
    onMutation,
    refreshKey,
  });

  return (
    <section
      aria-labelledby="cache-inspector-heading"
      className="border-t border-[var(--hairline)] pt-8"
    >
      <CacheInspectorControls
        canClear={inspector.data !== null}
        confirmClear={inspector.confirmClear}
        isClearing={inspector.isClearing}
        isLoading={inspector.isLoading}
        isMutating={inspector.isMutating}
        search={inspector.search}
        sort={inspector.sort}
        onCancelClear={inspector.cancelClear}
        onConfirmClear={() => void inspector.confirmClearCache()}
        onRefresh={inspector.refresh}
        onRequestClear={inspector.requestClear}
        onSearchChange={inspector.setSearch}
        onSortChange={inspector.setSort}
      />
      <CacheInspectorResults inspector={inspector} />
    </section>
  );
}
