import { defineLazyPathRoute } from "./lazyRoute";

const cacheRoutes = [
  defineLazyPathRoute(
    "cache",
    "cache",
    () => import("../pages/CachePage"),
    "CachePage",
  ),
];

export default cacheRoutes;
