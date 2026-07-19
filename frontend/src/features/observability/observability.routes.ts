import { defineLazyPathRoute } from "@/app/router/lazyPage";

const observabilityRoutes = [
  defineLazyPathRoute(
    "observability",
    "observability",
    () => import("./pages/ObservabilityPage"),
    "ObservabilityPage",
  ),
];

export default observabilityRoutes;
