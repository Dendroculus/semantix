import { defineLazyPathRoute } from "@/app/router/lazyPage";
import { APP_PATHS } from "@/app/navigation/navigationConfig";

const benchmarkRoutes = [
  defineLazyPathRoute(
    APP_PATHS.benchmarks.slice(1),
    "benchmarks",
    () => import("./pages/BenchmarksPage"),
    "BenchmarksPage",
  ),
];

export default benchmarkRoutes;
