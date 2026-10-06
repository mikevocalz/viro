export type ViroEsikuTarget =
  | "android-xr" | "xreal-aura" | "rayneo" | "viture"
  | "vive-eagle" | "steam-frame" | "quest" | "vision-pro" | "unknown";

export type ViroEsikuCapability =
  | "stereo-display" | "head-pose" | "pose-6dof" | "hand-tracking"
  | "eye-gaze" | "passthrough" | "camera" | "depth" | "planes"
  | "scene-understanding" | "world-anchors" | "controller" | "touch"
  | "gesture" | "haptics" | "spatial-audio" | "microphone"
  | "voice-input" | "voice-output" | "wearable-display" | "device-control";

export type ViroEsikuCapabilityState =
  | "supported" | "unsupported" | "permission-required"
  | "temporarily-unavailable" | "unverified";

export type ViroEsikuCapabilities = Partial<
  Record<ViroEsikuCapability, ViroEsikuCapabilityState>
>;

export type ViroEsikuRuntimeInfo = {
  target: ViroEsikuTarget;
  backend: "openxr" | "viture-native" | "wearable";
  runtime?: string;
  model?: string;
  capabilities: ViroEsikuCapabilities;
};

export function usesViroEsikuOpenXR(target: ViroEsikuTarget): boolean {
  return (
    target === "android-xr" ||
    target === "xreal-aura" ||
    target === "rayneo" ||
    target === "steam-frame" ||
    target === "quest"
  );
}
