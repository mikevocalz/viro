/**
 * Internal TypeScript facade for the language-neutral Viro engine contract.
 *
 * This module intentionally does not expose the native uint64 capability mask as
 * a JavaScript number. React Native/JS numbers cannot safely represent arbitrary
 * 64-bit integers, so native bridges transport the mask as two uint32 words.
 */
export declare const VIRO_ENGINE_ABI_MAJOR = 0;
export declare const VIRO_ENGINE_ABI_MIN_MINOR = 1;
export type ViroEngineBackend = "unknown" | "cpp" | "eskiu" | "wasm";
export type ViroEngineCapability = "openxr" | "ar-tracking" | "spatial-anchors" | "shared-frames" | "world-mesh" | "controller" | "hand-tracking" | "gaze" | "stylus" | "camera-texture" | "recording" | "external-surface" | "dynamic-geometry";
export interface ViroEngineNativeAbiInfo {
    structSize: number;
    abiMajor: number;
    abiMinor: number;
    backendKind: number;
    capabilitiesLow: number;
    capabilitiesHigh: number;
}
export interface ViroEngineContractInfo {
    available: boolean;
    compatible: boolean;
    abiMajor: number | null;
    abiMinor: number | null;
    backend: ViroEngineBackend;
    capabilities: ReadonlySet<ViroEngineCapability>;
    reason: "ok" | "native-module-missing" | "abi-major-mismatch" | "abi-too-old";
}
export type ViroEngineDomain = "input" | "spatial" | "surface" | "media" | "geometry" | "world-mesh" | "asset-loading";
export type ViroEngineBackendPreference = "auto" | "cpp" | "eskiu";
export interface ViroEngineContractNativeModule {
    queryAbi(): Promise<ViroEngineNativeAbiInfo>;
    setBackendPreference?(domain: number, preference: number): Promise<number>;
    getBackendPreference?(domain: number): Promise<number>;
}
export declare function viroEngineDomainCode(domain: ViroEngineDomain): number;
export declare function viroEnginePreferenceCode(preference: ViroEngineBackendPreference): number;
export declare function viroEnginePreferenceFromCode(code: number): ViroEngineBackendPreference;
export declare function decodeViroEngineCapabilities(low: number, high: number): ReadonlySet<ViroEngineCapability>;
export declare function normalizeViroEngineAbiInfo(native: ViroEngineNativeAbiInfo): ViroEngineContractInfo;
export declare function queryViroEngineContract(nativeModule: ViroEngineContractNativeModule | null | undefined): Promise<ViroEngineContractInfo>;
/**
 * Capability helper for app/runtime feature gates.
 * Only compatible contract snapshots are considered usable.
 */
export declare function hasViroEngineCapability(info: ViroEngineContractInfo | null | undefined, capability: ViroEngineCapability): boolean;
