import { Platform } from "react-native";
import { create } from "zustand";
import {
  hasOpenXRSupport,
  isMetaHorizonXR,
  isPico,
  isVisionOS,
  isWeb,
} from "../Utilities/ViroPlatform";

export type ViroXRPlatform =
  | "specs"
  | "horizon"
  | "pico"
  | "visionos"
  | "android"
  | "ios"
  | "web"
  | "unknown";

export type ViroXRCapability =
  | "immersive-rendering"
  | "world-tracking"
  | "world-query"
  | "surface-placement"
  | "anchors"
  | "plane-detection"
  | "hand-tracking"
  | "gaze-targeting"
  | "eye-gaze"
  | "pinch"
  | "drag-manipulation"
  | "controllers"
  | "camera"
  | "depth"
  | "spatial-audio"
  | "location-navigation"
  | "volumetric-line"
  | "colocation"
  | "system-windows";

export type ViroXRCapabilityState =
  | "supported"
  | "unsupported"
  | "permission-required"
  | "temporarily-unavailable"
  | "unverified";

export type ViroXRCapabilities = Partial<
  Record<ViroXRCapability, ViroXRCapabilityState>
>;

export interface ViroXRRuntimeSnapshot {
  platform: ViroXRPlatform;
  runtime: string;
  deviceFamily?: string;
  isSpecs: boolean;
  isHorizon: boolean;
  isPico: boolean;
  isVisionOS: boolean;
  isWeb: boolean;
  isPhysicalDevice: boolean;
  isSimulator: boolean;
  isEditor: boolean;
  capabilities: ViroXRCapabilities;
}

export interface ViroXRRuntimeProvider {
  getSnapshot(): ViroXRRuntimeSnapshot;
  subscribe?(listener: () => void): () => void;
}

type RuntimeStore = ViroXRRuntimeSnapshot & {
  __providerVersion: number;
};

type ViroBuildGlobals = typeof globalThis & {
  __VIRO_SPECS_BUILD__?: boolean;
  __VIRO_XR_TARGET__?: string;
};

function specsBuildMarker(): boolean {
  const globals = globalThis as ViroBuildGlobals;
  if (globals.__VIRO_SPECS_BUILD__ === true) return true;
  if (globals.__VIRO_XR_TARGET__ === "specs") return true;

  if (typeof process !== "undefined") {
    const target = process.env?.VIRO_XR_TARGET ?? process.env?.VIRO_TARGET;
    if (target === "specs") return true;
  }
  return false;
}

function initialRuntime(): ViroXRRuntimeSnapshot {
  if (specsBuildMarker()) {
    return {
      platform: "specs",
      runtime: "lens-studio",
      isSpecs: true,
      isHorizon: false,
      isPico: false,
      isVisionOS: false,
      isWeb: false,
      isPhysicalDevice: false,
      isSimulator: false,
      isEditor: false,
      capabilities: {},
    };
  }

  if (isMetaHorizonXR) {
    return {
      platform: "horizon",
      runtime: hasOpenXRSupport ? "openxr" : "android",
      isSpecs: false,
      isHorizon: true,
      isPico: false,
      isVisionOS: false,
      isWeb: false,
      isPhysicalDevice: true,
      isSimulator: false,
      isEditor: false,
      capabilities: {
        "immersive-rendering": hasOpenXRSupport ? "supported" : "unverified",
        "world-tracking": hasOpenXRSupport ? "supported" : "unverified",
        "controllers": hasOpenXRSupport ? "supported" : "unverified",
      },
    };
  }

  if (isPico) {
    return {
      platform: "pico",
      runtime: hasOpenXRSupport ? "openxr" : "android",
      isSpecs: false,
      isHorizon: false,
      isPico: true,
      isVisionOS: false,
      isWeb: false,
      isPhysicalDevice: true,
      isSimulator: false,
      isEditor: false,
      capabilities: {
        "immersive-rendering": hasOpenXRSupport ? "supported" : "unverified",
        "world-tracking": hasOpenXRSupport ? "supported" : "unverified",
        "controllers": hasOpenXRSupport ? "supported" : "unverified",
      },
    };
  }

  if (isVisionOS) {
    return {
      platform: "visionos",
      runtime: "visionos",
      isSpecs: false,
      isHorizon: false,
      isPico: false,
      isVisionOS: true,
      isWeb: false,
      isPhysicalDevice: true,
      isSimulator: false,
      isEditor: false,
      capabilities: {
        "immersive-rendering": "supported",
        "world-tracking": "supported",
        "gaze-targeting": "supported",
        "hand-tracking": "supported",
      },
    };
  }

  if (isWeb) {
    return {
      platform: "web",
      runtime: "web",
      isSpecs: false,
      isHorizon: false,
      isPico: false,
      isVisionOS: false,
      isWeb: true,
      isPhysicalDevice: false,
      isSimulator: false,
      isEditor: false,
      capabilities: {},
    };
  }

  return {
    platform:
      Platform.OS === "android"
        ? "android"
        : Platform.OS === "ios"
          ? "ios"
          : "unknown",
    runtime: Platform.OS,
    isSpecs: false,
    isHorizon: false,
    isPico: false,
    isVisionOS: false,
    isWeb: false,
    isPhysicalDevice: true,
    isSimulator: false,
    isEditor: false,
    capabilities: {},
  };
}

const initial = initialRuntime();

const useViroXRRuntimeStore = create<RuntimeStore>(() => ({
  ...initial,
  __providerVersion: 0,
}));

let provider: ViroXRRuntimeProvider | null = null;
let providerUnsubscribe: (() => void) | null = null;

function publishSnapshot(snapshot: ViroXRRuntimeSnapshot): void {
  useViroXRRuntimeStore.setState((state) => ({
    ...snapshot,
    __providerVersion: state.__providerVersion + 1,
  }));
}

export function registerViroXRRuntimeProvider(
  nextProvider: ViroXRRuntimeProvider
): () => void {
  providerUnsubscribe?.();
  provider = nextProvider;
  publishSnapshot(nextProvider.getSnapshot());

  providerUnsubscribe =
    nextProvider.subscribe?.(() => {
      if (provider === nextProvider) {
        publishSnapshot(nextProvider.getSnapshot());
      }
    }) ?? null;

  return () => {
    if (provider !== nextProvider) return;
    providerUnsubscribe?.();
    providerUnsubscribe = null;
    provider = null;
    publishSnapshot(initialRuntime());
  };
}

export function getXRRuntime(): ViroXRRuntimeSnapshot {
  const state = useViroXRRuntimeStore.getState();
  const { __providerVersion: _ignored, ...snapshot } = state;
  return snapshot;
}

export function useXRRuntime(): ViroXRRuntimeSnapshot {
  return useViroXRRuntimeStore((state) => {
    const { __providerVersion: _ignored, ...snapshot } = state;
    return snapshot;
  });
}

export function hasXRCapability(
  capability: ViroXRCapability,
  snapshot: ViroXRRuntimeSnapshot = getXRRuntime()
): boolean {
  return snapshot.capabilities[capability] === "supported";
}

export function isSpecsBuild(): boolean {
  return getXRRuntime().isSpecs || specsBuildMarker();
}
