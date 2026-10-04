export type ViroXRRuntimeKind = "virocore" | "specs" | "web" | "visionos" | "unknown";
export type ViroXRRuntimeCapability = "immersive-rendering" | "display" | "motion" | "hand-tracking" | "pinch" | "gaze-targeting" | "drag-manipulation" | "world-query" | "surface-placement" | "volumetric-line" | "location-navigation" | "runtime-inspection" | "synthetic-interaction";
export type ViroXRRuntimeCapabilityState = "supported" | "unsupported" | "permission-required" | "temporarily-unavailable" | "unverified";
export type ViroXRRuntimeInfo = {
    kind: ViroXRRuntimeKind;
    isSpecs: boolean;
    isViroCore: boolean;
    capabilities: Partial<Record<ViroXRRuntimeCapability, ViroXRRuntimeCapabilityState>>;
};
export declare function isViroSpecsRuntime(): boolean;
export declare function getViroXRRuntime(): ViroXRRuntimeInfo;
export declare function hasViroXRRuntimeCapability(capability: ViroXRRuntimeCapability, accepted?: readonly ViroXRRuntimeCapabilityState[]): boolean;
