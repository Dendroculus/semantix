import { lazy, type ComponentType } from "react";

import type {
  IndexRouteDefinition,
  PathRouteDefinition,
} from "../types/route";

type ComponentExportName<TModule> = {
  [TKey in keyof TModule]: TModule[TKey] extends ComponentType
    ? TKey
    : never;
}[keyof TModule] &
  string;

function lazyNamedPage<
  TModule,
  TExportName extends ComponentExportName<TModule>,
>(
  loadModule: () => Promise<TModule>,
  exportName: TExportName,
) {
  return lazy(async () => {
    const module = await loadModule();

    return {
      default: module[exportName] as ComponentType,
    };
  });
}

export function defineLazyIndexRoute<
  TModule,
  TExportName extends ComponentExportName<TModule>,
>(
  key: string,
  loadModule: () => Promise<TModule>,
  exportName: TExportName,
): IndexRouteDefinition {
  return {
    key,
    index: true,
    component: lazyNamedPage(loadModule, exportName),
  };
}

export function defineLazyPathRoute<
  TModule,
  TExportName extends ComponentExportName<TModule>,
>(
  key: string,
  path: string,
  loadModule: () => Promise<TModule>,
  exportName: TExportName,
): PathRouteDefinition {
  return {
    key,
    path,
    component: lazyNamedPage(loadModule, exportName),
  };
}
