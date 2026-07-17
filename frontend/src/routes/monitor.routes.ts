import { defineLazyIndexRoute } from "./lazyRoute";

const monitorRoutes = [
  defineLazyIndexRoute(
    "monitor",
    () => import("../pages/MonitorPage"),
    "MonitorPage",
  ),
];

export default monitorRoutes;
