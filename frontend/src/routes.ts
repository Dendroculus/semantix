import benchmarkRoutes from './routes/benchmark.routes';
import cacheRoutes from './routes/cache.routes';
import monitorRoutes from './routes/monitor.routes';
import specialRoutes from './routes/special.routes';
import type { AppRouteDefinition } from './types/route';

const routes: AppRouteDefinition[] = [
  ...monitorRoutes,
  ...cacheRoutes,
  ...benchmarkRoutes,
  ...specialRoutes,
];

export default routes;
