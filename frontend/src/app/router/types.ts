import type {
  ComponentType,
  LazyExoticComponent,
} from "react";

interface BaseRouteDefinition {
  component:
    | ComponentType
    | LazyExoticComponent<ComponentType>;
  key: string;
}

export interface IndexRouteDefinition extends BaseRouteDefinition {
  index: true;
}

export interface PathRouteDefinition extends BaseRouteDefinition {
  path: string;
}

export type AppRouteDefinition =
  | IndexRouteDefinition
  | PathRouteDefinition;
