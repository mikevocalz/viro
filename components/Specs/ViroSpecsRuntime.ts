export type ViroXRRuntimeKind =
  | "virocore"
  | "specs"
  | "web"
  | "visionos"
  | "unknown";

export type ViroXRRuntimeCapability =
  | "immersive-rendering"
  | "display"
  | "motion"
  | "hand-tracking"
  | "pinch"
  | "gaze-targeting"
  | "drag-manipulation"
  | "world-query"
  | "surface-placement"
  | "volumetric-line"
  | "location-navigation"
  | "runtime-inspection"
  | "synthetic-interaction";

export type ViroXRRuntimeCapabilityState =
  | "supported"
  | "unsupported"
  | "permission-required"
  | "temporarily-unavailable"
  | "unverified";

export type ViroXRRuntimeInfo = {
  kind: ViroXRRuntimeKind;
  isSpecs: boolean;
  isViroCore: boolean;
  capabilities: Partial<
    Record<ViroXRRuntimeCapability, ViroXRRuntimeCapabilityState>
  >;
};

type SpecsGlobal = typeof globalThis & {
  __VIRO_SPECS_BUILD__?: boolean;
  __VIRO_SPECS_CAPABILITIES__?: Record<string, ViroXRRuntimeCapabilityState>;
};

function readSpecsGlobal(): SpecsGlobal {
  return globalThis as SpecsGlobal;
}

export function isViroSpecsRuntime(): boolean {
  return readSpecsGlobal().__VIRO_SPECS_BUILD__ === true;
}

export function getViroXRRuntime(): ViroXRRuntimeInfo {
  if (isViroSpecsRuntime()) {
    return {
      kind: "specs",
      isSpecs: true,
      isViroCore: false,
      capabilities: {
        ...(readSpecsGlobal().__VIRO_SPECS_CAPABILITIES__ ?? {}),
      },
    };
  }

  if (typeof navigator !== "undefined" && typeof document !== "undefined") {
    return {
      kind: "web",
      isSpecs: false,
      isViroCore: false,
      capabilities: {},
    };
  }

  return {
    kind: "virocore",
    isSpecs: false,
    isViroCore: true,
    capabilities: {},
  };
}

export function hasViroXRRuntimeCapability(
  capability: ViroXRRuntimeCapability,
  accepted: readonly ViroXRRuntimeCapabilityState[] = ["supported"]
): boolean {
  const state = getViroXRRuntime().capabilities[capability] ?? "unverified";
  return accepted.includes(state);
}
