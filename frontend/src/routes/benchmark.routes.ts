import { defineLazyPathRoute } from "./lazyRoute";

const benchmarkRoutes = [
  defineLazyPathRoute(
    "benchmarks",
    "benchmarks",
    () => import("../pages/BenchmarksPage"),
    "BenchmarksPage",
  ),
];

export default benchmarkRoutes;
