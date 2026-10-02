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

type RuntimeStore = {
  snapshot: ViroXRRuntimeSnapshot;
  providerVersion: number;
};

type ViroBuildGlobals = typeof globalThis & {
  __VIRO_SPECS_BUILD__?: boolean;
  __VIRO_XR_TARGET__?: string;
  __VIRO_SIMULATOR__?: boolean;
  __VIRO_PHYSICAL_DEVICE__?: boolean;
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

function explicitDeviceKind(): "simulator" | "physical" | "unknown" {
  const globals = globalThis as ViroBuildGlobals;
  if (globals.__VIRO_SIMULATOR__ === true) return "simulator";
  if (globals.__VIRO_PHYSICAL_DEVICE__ === true) return "physical";

  if (typeof process !== "undefined") {
    if (
      process.env?.SIMULATOR_UDID ||
      process.env?.SIMULATOR_DEVICE_NAME ||
      process.env?.ANDROID_EMULATOR === "true" ||
      process.env?.ROBOLECTRIC === "true"
    ) {
      return "simulator";
    }
  }

  const constants = Platform.constants as Record<string, unknown> | undefined;
  const fingerprint = String(constants?.Fingerprint ?? "").toLowerCase();
  const model = String(constants?.Model ?? "").toLowerCase();
  const brand = String(constants?.Brand ?? "").toLowerCase();
  const manufacturer = String(constants?.Manufacturer ?? "").toLowerCase();

  if (
    Platform.OS === "android" &&
    (
      fingerprint.includes("generic") ||
      fingerprint.includes("emulator") ||
      model.includes("sdk_gphone") ||
      model.includes("emulator") ||
      model.includes("android sdk built for") ||
      brand === "generic" ||
      manufacturer.includes("genymotion")
    )
  ) {
    return "simulator";
  }

  // React Native does not expose a guaranteed iOS simulator flag. Do not
  // manufacture a "physical" answer for generic iOS/Android fallbacks; an
  // exact platform adapter can register that identity when it matters.
  return "unknown";
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

  const deviceKind = explicitDeviceKind();

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
    isPhysicalDevice: deviceKind === "physical",
    isSimulator: deviceKind === "simulator",
    isEditor: false,
    capabilities: {},
  };
}

const initial = initialRuntime();

const useViroXRRuntimeStore = create<RuntimeStore>(() => ({
  snapshot: initial,
  providerVersion: 0,
}));

let provider: ViroXRRuntimeProvider | null = null;
let providerUnsubscribe: (() => void) | null = null;

function publishSnapshot(snapshot: ViroXRRuntimeSnapshot): void {
  const state = useViroXRRuntimeStore.getState();
  // Snapshot is a complete value: replacing this nested object guarantees that
  // optional properties from a previous provider cannot survive a provider
  // switch simply because Zustand merges top-level store state by default.
  useViroXRRuntimeStore.setState({
    snapshot,
    providerVersion: state.providerVersion + 1,
  });
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
  return useViroXRRuntimeStore.getState().snapshot;
}

export function useXRRuntime(): ViroXRRuntimeSnapshot {
  // Select the already-stable snapshot object. Constructing a fresh object in
  // this selector breaks useSyncExternalStore's snapshot identity contract and
  // can cause React 19/Zustand 5 render loops.
  return useViroXRRuntimeStore((state) => state.snapshot);
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
