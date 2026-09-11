import { useEffect, useState } from "react";
import { NativeModules } from "react-native";
import { VRQuestNavigatorBridge } from "./VRQuestNavigatorBridge";

/**
 * Finishes VRActivity and returns the user to the panel (MainActivity).
 * Safe to call on any platform — no-op when VRLauncher is unavailable.
 */
export function exitVRScene(): void {
  VRQuestNavigatorBridge.setVRActive(false);
  (NativeModules.VRLauncher as { exitVRScene?: () => void } | undefined)
    ?.exitVRScene?.();
}

/** Vertical tracking origin: "eye" = head-height (default), "floor" = physical floor. */
export type ViroTrackingOrigin = "eye" | "floor";

export type VRModuleOpenXRType = {
  recenterTracking?: (viewTag: number) => void;
  setPassthroughEnabled?: (viewTag: number, enabled: boolean) => void;
  setTrackingOrigin?: (viewTag: number, origin: ViroTrackingOrigin) => void;
  setPassthroughStyle?: (
    viewTag: number,
    opacity: number,
    edgeR: number,
    edgeG: number,
    edgeB: number,
    edgeA: number
  ) => void;
  triggerHaptic?: (
    viewTag: number,
    hand: number,
    amplitude: number,
    durationSec: number
  ) => void;
};

/**
 * Which controller to buzz. "active" (default) targets whichever controller
 * last pressed its trigger — so a UI press buzzes the hand that pressed it,
 * never the idle one.
 */
export type ViroHapticHand = "left" | "right" | "both" | "active";

const HAND_CODE: Record<ViroHapticHand, number> = {
  left: 0,
  right: 1,
  both: 2,
  active: -1,
};

/**
 * Fire a native OpenXR controller haptic pulse (XR_FB / touch controller).
 * No-op off-Quest/PICO. amplitude ∈ [0,1], durationSec in seconds.
 *
 * ```tsx
 * const viewTag = useVRViewTag();
 * if (viewTag != null) triggerHaptic(viewTag);            // quick tick, active hand
 * ```
 */
export function triggerHaptic(
  viewTag: number,
  opts: { hand?: ViroHapticHand; amplitude?: number; durationSec?: number } = {}
): void {
  const hand = HAND_CODE[opts.hand ?? "active"];
  VRModuleOpenXR?.triggerHaptic?.(
    viewTag,
    hand,
    opts.amplitude ?? 0.6,
    opts.durationSec ?? 0.03
  );
}

/** Options for {@link setPassthroughStyle}. All channels are normalized [0,1]. */
export type ViroPassthroughStyle = {
  /** Texture opacity factor [0,1]. Default 1 (fully opaque passthrough). */
  opacity?: number;
  /** Edge-highlight colour [r,g,b,a]. Alpha 0 (default) disables the edge effect. */
  edgeColor?: [number, number, number, number];
};

/**
 * Style the Quest passthrough layer (XR_FB_passthrough). No-op off-Quest.
 *
 * ```tsx
 * const viewTag = useVRViewTag();
 * if (viewTag != null) {
 *   setPassthroughStyle(viewTag, { opacity: 0.8, edgeColor: [0, 1, 1, 1] });
 * }
 * ```
 */
export function setPassthroughStyle(
  viewTag: number,
  style: ViroPassthroughStyle
): void {
  const opacity = style.opacity ?? 1;
  const [r, g, b, a] = style.edgeColor ?? [0, 0, 0, 0];
  VRModuleOpenXR?.setPassthroughStyle?.(viewTag, opacity, r, g, b, a);
}

/**
 * Typed reference to the VRModuleOpenXR native module.
 * undefined when not running on Meta Quest (no-op calls are safe via optional chaining).
 */
export const VRModuleOpenXR =
  (NativeModules.VRModuleOpenXR as VRModuleOpenXRType | undefined) ?? undefined;

/**
 * Returns the live viewTag of the ViroVRSceneNavigator running in VRActivity,
 * kept in sync via VRQuestNavigatorBridge.  null until ViroQuestEntryPoint has
 * mounted and published the tag.
 *
 * Use this inside VR scenes when you need to call VRModuleOpenXR methods:
 *
 * ```tsx
 * function MyVRScene() {
 *   const viewTag = useVRViewTag();
 *   const recenter = () => {
 *     if (viewTag != null) VRModuleOpenXR?.recenterTracking?.(viewTag);
 *   };
 *   return <ViroScene>...</ViroScene>;
 * }
 * ```
 */
export function useVRViewTag(): number | null {
  const [tag, setTag] = useState<number | null>(
    () => VRQuestNavigatorBridge.getViewTag()
  );
  useEffect(() => VRQuestNavigatorBridge.onViewTag(setTag), []);
  return tag;
}
