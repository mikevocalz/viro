import * as React from "react";

type SpatialSceneProviderComponent = React.ComponentType<{
  children?: React.ReactNode;
  [key: string]: unknown;
}>;

type SpatialWindowComponent = React.ComponentType<{
  children?: React.ReactNode;
  [key: string]: unknown;
}>;

type MetaSceneModule = { SpatialSceneProvider?: SpatialSceneProviderComponent };
type MetaWindowModule = { SpatialWindow?: SpatialWindowComponent };

let sceneModule: MetaSceneModule | null | undefined;
let windowModule: MetaWindowModule | null | undefined;

function loadSceneModule(): MetaSceneModule | null {
  if (sceneModule !== undefined) return sceneModule;
  try {
    sceneModule = require("@metavr/layout-compat") as MetaSceneModule;
  } catch {
    sceneModule = null;
  }
  return sceneModule;
}

function loadWindowModule(): MetaWindowModule | null {
  if (windowModule !== undefined) return windowModule;
  try {
    windowModule = require("@metavr/layout-window-compat") as MetaWindowModule;
  } catch {
    windowModule = null;
  }
  return windowModule;
}

export type ViroSpatialWindowFallback = "inline" | "drop";
export type ViroSpatialSceneProviderProps = {
  children?: React.ReactNode;
  [key: string]: unknown;
};
export type ViroSpatialWindowProps = {
  label: string;
  windowWidth?: number;
  windowHeight?: number;
  fallback?: ViroSpatialWindowFallback;
  children?: React.ReactNode;
  [key: string]: unknown;
};

export function isMetaSpatialLayoutAvailable(): boolean {
  return Boolean(loadSceneModule()?.SpatialSceneProvider && loadWindowModule()?.SpatialWindow);
}

export function ViroSpatialSceneProvider({ children, ...props }: ViroSpatialSceneProviderProps): React.ReactElement {
  const Provider = loadSceneModule()?.SpatialSceneProvider;
  if (!Provider) return React.createElement(React.Fragment, null, children);
  return React.createElement(Provider, props, children);
}

export function ViroSpatialWindow({ children, fallback = "inline", ...props }: ViroSpatialWindowProps): React.ReactElement | null {
  const SpatialWindow = loadWindowModule()?.SpatialWindow;
  if (!SpatialWindow) {
    return fallback === "drop" ? null : React.createElement(React.Fragment, null, children);
  }
  return React.createElement(SpatialWindow, { ...props, fallback }, children);
}
