import { defineLazyPathRoute } from "@/app/router/lazyPage";
import { APP_PATHS } from "@/app/navigation/navigationConfig";

const cacheRoutes = [
  defineLazyPathRoute(
    APP_PATHS.cache.slice(1),
    "cache",
    () => import("./pages/CachePage"),
    "CachePage",
  ),
];

export default cacheRoutes;
