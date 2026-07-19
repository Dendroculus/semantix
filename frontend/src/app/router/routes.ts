import { NotFoundPage } from "../pages/NotFoundPage";
import benchmarkRoutes from "@/features/benchmark/benchmark.routes";
import cacheRoutes from "@/features/cache/cache.routes";
import monitorRoutes from "@/features/monitor/monitor.routes";
import observabilityRoutes from "@/features/observability/observability.routes";
import type { AppRouteDefinition } from "./types";

const routes: AppRouteDefinition[] = [
  ...monitorRoutes,
  ...cacheRoutes,
  ...benchmarkRoutes,
  ...observabilityRoutes,
  {
    key: "not-found",
    path: "*",
    component: NotFoundPage,
  },
];

export default routes;
