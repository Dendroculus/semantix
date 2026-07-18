import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

import type {
  AppRouteDefinition,
  IndexRouteDefinition,
  PathRouteDefinition,
} from "./types";

function lazyNamedPage<
  TExportName extends string,
  TModule extends Record<TExportName, ComponentType>,
>(
  importer: () => Promise<TModule>,
  exportName: TExportName,
): LazyExoticComponent<ComponentType> {
  return lazy(async () => {
    const module = await importer();

    return {
      default: module[exportName],
    };
  });
}

export function defineLazyIndexRoute<
  TExportName extends string,
  TModule extends Record<TExportName, ComponentType>,
>(
  key: string,
  importer: () => Promise<TModule>,
  exportName: TExportName,
): IndexRouteDefinition {
  return {
    key,
    index: true,
    component: lazyNamedPage(importer, exportName),
  };
}

export function defineLazyPathRoute<
  TExportName extends string,
  TModule extends Record<TExportName, ComponentType>,
>(
  key: string,
  path: string,
  importer: () => Promise<TModule>,
  exportName: TExportName,
  children?: AppRouteDefinition[],
): PathRouteDefinition {
  return {
    key,
    path,
    component: lazyNamedPage(importer, exportName),
    ...(children?.length ? { children } : {}),
  };
}