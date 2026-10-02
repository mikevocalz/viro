import { NativeModules } from "react-native";

/**
 * Stable capability bits shared with ViroCore's VROEngineContract.h.
 * Keep numeric values in lockstep with the native ABI.
 */
export const ViroEngineCapability = {
  openXR: 1 << 0,
  arTracking: 1 << 1,
  spatialAnchors: 1 << 2,
  sharedFrames: 1 << 3,
  worldMesh: 1 << 4,
  controllerInput: 1 << 5,
  handTracking: 1 << 6,
  gazeInput: 1 << 7,
  stylusInput: 1 << 8,
  cameraTexture: 1 << 9,
  recording: 1 << 10,
  externalSurface: 1 << 11,
  dynamicGeometry: 1 << 12,
  webWasm: 1 << 13,
} as const;

export type ViroEngineCapabilityName = keyof typeof ViroEngineCapability;
export type ViroEngineBackend = "unknown" | "cpp" | "eskiu" | "wasm";

export type ViroEngineContractInfo = {
  major: number;
  minor: number;
  backend: ViroEngineBackend;
  backendName: string;
  buildId: string;
  capabilities: number;
};

type NativeEngineContractInfo = {
  major?: number;
  minor?: number;
  backend?: number | string;
  backendName?: string;
  backend_name?: string;
  buildId?: string;
  build_id?: string;
  capabilities?: number;
};

type ViroEngineContractNativeModule = {
  getInfo?: () => Promise<NativeEngineContractInfo | null>;
};

const BACKEND_BY_CODE: Record<number, ViroEngineBackend> = {
  0: "unknown",
  1: "cpp",
  2: "eskiu",
  3: "wasm",
};

function normalizeBackend(value: number | string | undefined): ViroEngineBackend {
  if (typeof value === "number") return BACKEND_BY_CODE[value] ?? "unknown";
  if (value === "cpp" || value === "eskiu" || value === "wasm") return value;
  return "unknown";
}

export function normalizeViroEngineContractInfo(
  raw: NativeEngineContractInfo | null | undefined
): ViroEngineContractInfo | null {
  if (!raw) return null;
  return {
    major: Number.isFinite(raw.major) ? Number(raw.major) : 0,
    minor: Number.isFinite(raw.minor) ? Number(raw.minor) : 0,
    backend: normalizeBackend(raw.backend),
    backendName: raw.backendName ?? raw.backend_name ?? "unknown",
    buildId: raw.buildId ?? raw.build_id ?? "unknown",
    capabilities: Number.isFinite(raw.capabilities) ? Number(raw.capabilities) : 0,
  };
}

/**
 * Queries the optional native engine-contract bridge.
 *
 * Returns null on platforms/builds that have not wired the contract bridge yet.
 * This is deliberately feature-detection based: callers should not infer the
 * renderer implementation from device model or platform name.
 */
export async function getViroEngineContractInfo(): Promise<ViroEngineContractInfo | null> {
  const nativeModule = NativeModules.ViroEngineContract as
    | ViroEngineContractNativeModule
    | undefined;
  const raw = await nativeModule?.getInfo?.();
  return normalizeViroEngineContractInfo(raw);
}

export function hasViroEngineCapability(
  info: Pick<ViroEngineContractInfo, "capabilities"> | null | undefined,
  capability: ViroEngineCapabilityName | number
): boolean {
  if (!info) return false;
  const bit =
    typeof capability === "number"
      ? capability
      : ViroEngineCapability[capability];
  return (info.capabilities & bit) === bit;
}

export function listViroEngineCapabilities(
  info: Pick<ViroEngineContractInfo, "capabilities"> | null | undefined
): ViroEngineCapabilityName[] {
  if (!info) return [];
  return (Object.keys(ViroEngineCapability) as ViroEngineCapabilityName[]).filter(
    (name) => hasViroEngineCapability(info, name)
  );
}
