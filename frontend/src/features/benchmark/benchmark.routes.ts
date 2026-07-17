import { defineLazyPathRoute } from "../../app/router/lazyPage";

const benchmarkRoutes = [
  defineLazyPathRoute(
    "benchmarks",
    "benchmarks",
    () => import("./pages/BenchmarksPage"),
    "BenchmarksPage",
  ),
];

export default benchmarkRoutes;
