import { defineLazyPathRoute } from "./lazyRoute";

const specialRoutes = [
  defineLazyPathRoute(
    "not-found",
    "*",
    () => import("../pages/NotFoundPage"),
    "NotFoundPage",
  ),
];

export default specialRoutes;
