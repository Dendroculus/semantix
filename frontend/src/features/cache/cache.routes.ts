import { defineLazyPathRoute } from "../../app/router/lazyPage";

const cacheRoutes = [
  defineLazyPathRoute(
    "cache",
    "cache",
    () => import("./pages/CachePage"),
    "CachePage",
  ),
];

export default cacheRoutes;
