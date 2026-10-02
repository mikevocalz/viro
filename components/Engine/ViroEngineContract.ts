/**
 * Internal TypeScript facade for the language-neutral Viro engine contract.
 *
 * This module intentionally does not expose the native uint64 capability mask as
 * a JavaScript number. React Native/JS numbers cannot safely represent arbitrary
 * 64-bit integers, so native bridges transport the mask as two uint32 words.
 */

export const VIRO_ENGINE_ABI_MAJOR = 0;
export const VIRO_ENGINE_ABI_MIN_MINOR = 1;

export type ViroEngineBackend = "unknown" | "cpp" | "eskiu" | "wasm";

export type ViroEngineCapability =
  | "openxr"
  | "ar-tracking"
  | "spatial-anchors"
  | "shared-frames"
  | "world-mesh"
  | "controller"
  | "hand-tracking"
  | "gaze"
  | "stylus"
  | "camera-texture"
  | "recording"
  | "external-surface"
  | "dynamic-geometry";

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

export type ViroEngineDomain =
  | "input"
  | "spatial"
  | "surface"
  | "media"
  | "geometry"
  | "world-mesh"
  | "asset-loading";

export type ViroEngineBackendPreference = "auto" | "cpp" | "eskiu";

export interface ViroEngineContractNativeModule {
  queryAbi(): Promise<ViroEngineNativeAbiInfo>;
  setBackendPreference?(domain: number, preference: number): Promise<number>;
  getBackendPreference?(domain: number): Promise<number>;
}

const DOMAIN_CODE: Record<ViroEngineDomain, number> = {
  input: 0,
  spatial: 1,
  surface: 2,
  media: 3,
  geometry: 4,
  "world-mesh": 5,
  "asset-loading": 6,
};

const PREFERENCE_CODE: Record<ViroEngineBackendPreference, number> = {
  auto: 0,
  cpp: 1,
  eskiu: 2,
};

const CODE_PREFERENCE: Record<number, ViroEngineBackendPreference> = {
  0: "auto",
  1: "cpp",
  2: "eskiu",
};

export function viroEngineDomainCode(domain: ViroEngineDomain): number {
  return DOMAIN_CODE[domain];
}

export function viroEnginePreferenceCode(
  preference: ViroEngineBackendPreference
): number {
  return PREFERENCE_CODE[preference];
}

export function viroEnginePreferenceFromCode(
  code: number
): ViroEngineBackendPreference {
  return CODE_PREFERENCE[code] ?? "auto";
}

const CAPABILITY_BITS: readonly [ViroEngineCapability, number][] = [
  ["openxr", 0],
  ["ar-tracking", 1],
  ["spatial-anchors", 2],
  ["shared-frames", 3],
  ["world-mesh", 4],
  ["controller", 5],
  ["hand-tracking", 6],
  ["gaze", 7],
  ["stylus", 8],
  ["camera-texture", 9],
  ["recording", 10],
  ["external-surface", 11],
  ["dynamic-geometry", 12],
];

function backendFromNative(kind: number): ViroEngineBackend {
  switch (kind) {
    case 1:
      return "cpp";
    case 2:
      return "eskiu";
    case 3:
      return "wasm";
    default:
      return "unknown";
  }
}

function wordHasBit(word: number, bit: number): boolean {
  return (((word >>> 0) >>> bit) & 1) === 1;
}

export function decodeViroEngineCapabilities(
  low: number,
  high: number
): ReadonlySet<ViroEngineCapability> {
  const result = new Set<ViroEngineCapability>();
  for (const [name, bit] of CAPABILITY_BITS) {
    const present =
      bit < 32 ? wordHasBit(low, bit) : wordHasBit(high, bit - 32);
    if (present) result.add(name);
  }
  return result;
}

export function normalizeViroEngineAbiInfo(
  native: ViroEngineNativeAbiInfo
): ViroEngineContractInfo {
  const backend = backendFromNative(native.backendKind);
  const capabilities = decodeViroEngineCapabilities(
    native.capabilitiesLow,
    native.capabilitiesHigh
  );

  if (native.abiMajor !== VIRO_ENGINE_ABI_MAJOR) {
    return {
      available: true,
      compatible: false,
      abiMajor: native.abiMajor,
      abiMinor: native.abiMinor,
      backend,
      capabilities,
      reason: "abi-major-mismatch",
    };
  }

  if (native.abiMinor < VIRO_ENGINE_ABI_MIN_MINOR) {
    return {
      available: true,
      compatible: false,
      abiMajor: native.abiMajor,
      abiMinor: native.abiMinor,
      backend,
      capabilities,
      reason: "abi-too-old",
    };
  }

  return {
    available: true,
    compatible: true,
    abiMajor: native.abiMajor,
    abiMinor: native.abiMinor,
    backend,
    capabilities,
    reason: "ok",
  };
}

export async function queryViroEngineContract(
  nativeModule: ViroEngineContractNativeModule | null | undefined
): Promise<ViroEngineContractInfo> {
  if (!nativeModule) {
    return {
      available: false,
      compatible: false,
      abiMajor: null,
      abiMinor: null,
      backend: "unknown",
      capabilities: new Set<ViroEngineCapability>(),
      reason: "native-module-missing",
    };
  }

  return normalizeViroEngineAbiInfo(await nativeModule.queryAbi());
}


/**
 * Capability helper for app/runtime feature gates.
 * Only compatible contract snapshots are considered usable.
 */
export function hasViroEngineCapability(
  info: ViroEngineContractInfo | null | undefined,
  capability: ViroEngineCapability
): boolean {
  return !!info?.compatible && info.capabilities.has(capability);
}
