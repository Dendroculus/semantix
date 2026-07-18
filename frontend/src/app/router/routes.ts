import { NotFoundPage } from "../pages/NotFoundPage";
import benchmarkRoutes from "@/features/benchmark/benchmark.routes";
import cacheRoutes from "@/features/cache/cache.routes";
import monitorRoutes from "@/features/monitor/monitor.routes";
import type { AppRouteDefinition } from "./types";

const routes: AppRouteDefinition[] = [
  ...monitorRoutes,
  ...cacheRoutes,
  ...benchmarkRoutes,
  {
    key: "not-found",
    path: "*",
    component: NotFoundPage,
  },
];

export default routes;
