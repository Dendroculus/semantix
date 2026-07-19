export const APP_PATHS = {
  monitor: '/',
  cache: '/cache',
  benchmarks: '/benchmarks',
  observability: '/observability',
} as const;

export const NAV_ITEMS = [
  { label: 'Monitor', to: APP_PATHS.monitor },
  { label: 'Cache', to: APP_PATHS.cache },
  { label: 'Benchmarks', to: APP_PATHS.benchmarks },
  { label: 'Observability', to: APP_PATHS.observability },
] as const;
