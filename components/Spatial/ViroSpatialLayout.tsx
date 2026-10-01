/**
 * Compatibility facade for Meta VR Layout SDK spatial windows.
 *
 * The Meta packages stay optional peers. On Android, when they are installed,
 * this delegates to Meta's compatibility layer, which handles Horizon OS
 * spatial placement and inline/drop fallback on unsupported Android hosts.
 * On iOS, visionOS and web, or if the optional peers are absent, Viro applies
 * the same fallback semantics locally.
 */
import * as React from "react";
import { Platform } from "react-native";
import { isMetaHorizonXR } from "../Utilities/ViroPlatform";

export type ViroSpatialFallback = "inline" | "drop";

export interface ViroSpatialSceneProviderProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface ViroSpatialWindowProps {
  /** Stable identifier used by Meta to preserve placement state. */
  label: string;
  /** Required by Meta's React Native Layout SDK. */
  windowWidth: number;
  /** Required by Meta's React Native Layout SDK. */
  windowHeight: number;
  fallback?: ViroSpatialFallback;
  priority?: number;
  anchor?: unknown;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface ViroSpatialLayoutSupport {
  platform: string;
  basePackageAvailable: boolean;
  windowPackageAvailable: boolean;
  nativeSpatialLayoutAvailable: boolean;
}

type MetaLayoutModule = {
  SpatialSceneProvider: React.ComponentType<any>;
};
type MetaWindowModule = {
  SpatialWindow: React.ComponentType<any>;
};

let modules:
  | { layout: MetaLayoutModule; window: MetaWindowModule }
  | null
  | undefined;
let warned = false;

function loadMetaSpatialModules():
  | { layout: MetaLayoutModule; window: MetaWindowModule }
  | null {
  if (modules !== undefined) return modules;
  if (Platform.OS !== "android" || !isMetaHorizonXR) {
    modules = null;
    return modules;
  }
  try {
    const layout = require("@metavr/layout-compat") as MetaLayoutModule;
    const window = require("@metavr/layout-window-compat") as MetaWindowModule;
    modules = { layout, window };
  } catch {
    modules = null;
  }
  return modules;
}

function fallbackNode(
  children: React.ReactNode,
  fallback: ViroSpatialFallback = "inline"
): React.ReactElement | null {
  return fallback === "drop"
    ? null
    : React.createElement(React.Fragment, null, children);
}

export function getViroSpatialLayoutSupport(): ViroSpatialLayoutSupport {
  const resolved = loadMetaSpatialModules();
  return {
    platform: Platform.OS,
    basePackageAvailable: !!resolved?.layout?.SpatialSceneProvider,
    windowPackageAvailable: !!resolved?.window?.SpatialWindow,
    nativeSpatialLayoutAvailable:
      Platform.OS === "android" &&
      isMetaHorizonXR &&
      !!resolved?.layout?.SpatialSceneProvider &&
      !!resolved?.window?.SpatialWindow,
  };
}

export function ViroSpatialSceneProvider(
  props: ViroSpatialSceneProviderProps
): React.ReactElement {
  const { children, ...rest } = props;
  const resolved = loadMetaSpatialModules();
  if (!resolved?.layout?.SpatialSceneProvider) {
    return React.createElement(React.Fragment, null, children);
  }
  return React.createElement(resolved.layout.SpatialSceneProvider, rest, children);
}

export function ViroSpatialWindow(
  props: ViroSpatialWindowProps
): React.ReactElement | null {
  const {
    children,
    fallback = "inline",
    label,
    windowWidth,
    windowHeight,
    ...rest
  } = props;
  const resolved = loadMetaSpatialModules();

  if (!resolved?.window?.SpatialWindow) {
    if (Platform.OS === "android" && isMetaHorizonXR && !warned) {
      warned = true;
      console.warn(
        "[Viro] Meta spatial windows requested without the optional Meta VR Layout SDK. " +
          "Install @metavr/layout-compat and @metavr/layout-window-compat as direct app dependencies, " +
          "then enable android.metaSpatialLayout in the Viro Expo plugin."
      );
    }
    return fallbackNode(children, fallback);
  }

  return React.createElement(
    resolved.window.SpatialWindow,
    { ...rest, label, windowWidth, windowHeight, fallback },
    children
  );
}
