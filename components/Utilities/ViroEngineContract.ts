export type ViroEngineBackend = "cpp" | "eskiu" | "wasm" | "unknown";

export type ViroEngineCapability =
  | "openxr"
  | "arTracking"
  | "spatialAnchors"
  | "sharedFrames"
  | "worldMesh"
  | "controller"
  | "handTracking"
  | "gaze"
  | "stylus"
  | "cameraTexture"
  | "recording"
  | "externalSurfaces"
  | "dynamicGeometry";

export interface ViroEngineContractInfo {
  versionMajor: number;
  versionMinor: number;
  backend: ViroEngineBackend;
  capabilities: readonly ViroEngineCapability[];
  buildId?: string;
}

export interface ViroEngineStatus {
  code: "ok" | "unsupported" | "invalidArgument" | "staleHandle" | "backendError";
  recoverable: boolean;
}

export interface ViroEnginePose {
  position: readonly [number, number, number];
  orientation: readonly [number, number, number, number];
}

export type ViroEngineInputKind =
  | "controller"
  | "hand"
  | "gaze"
  | "stylus"
  | "touch"
  | "mouse";

export interface ViroEngineInputSample {
  kind: ViroEngineInputKind;
  sourceId: number;
  timestampNs: bigint;
  pose: ViroEnginePose;
  analog?: readonly [number, number, number, number];
  buttons?: bigint;
}

export type ViroEngineSpatialFrameKind =
  | "local"
  | "stage"
  | "anchor"
  | "shared"
  | "geospatial";

export interface ViroEngineSpatialTransform {
  frameKind: ViroEngineSpatialFrameKind;
  frameId: bigint;
  timestampNs: bigint;
  pose: ViroEnginePose;
  scale: readonly [number, number, number];
}

export type ViroEngineSurfaceKind =
  | "gpuPanel"
  | "rive"
  | "three"
  | "camera"
  | "video";

export interface ViroEngineSurfaceDescriptor {
  kind: ViroEngineSurfaceKind;
  width: number;
  height: number;
  pixelFormat: "unknown" | "rgba8" | "bgra8" | "rgba16f";
  resourceHandle: bigint;
  frameId: bigint;
  timestampNs: bigint;
}

export const VIRO_ENGINE_CONTRACT_VERSION = Object.freeze({
  major: 1,
  minor: 0,
});

export function supportsViroEngineCapability(
  info: Pick<ViroEngineContractInfo, "capabilities">,
  capability: ViroEngineCapability
): boolean {
  return info.capabilities.includes(capability);
}
