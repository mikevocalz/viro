import { useEffect, useState } from "react";
import { NativeModules } from "react-native";
import { VRQuestNavigatorBridge } from "./VRQuestNavigatorBridge";
import { ViroRecordingErrorConstants } from "../ViroConstants";
/**
 * Finishes VRActivity and returns the user to the panel (MainActivity).
 * Safe to call on any platform — no-op when VRLauncher is unavailable.
 */
export function exitVRScene() {
    VRQuestNavigatorBridge.setVRActive(false);
    NativeModules.VRLauncher
        ?.exitVRScene?.();
}
/**
 * Query the active Android OpenXR renderer instead of inferring features from
 * the headset model. Returns null until the immersive view has initialized or
 * when the current backend is not ViroViewOpenXR.
 */
export async function getOpenXRRuntimeCapabilities(viewTag) {
    return VRModuleOpenXR?.getRuntimeCapabilities?.(viewTag) ?? null;
}
const HAND_CODE = {
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
export function triggerHaptic(viewTag, opts = {}) {
    const hand = HAND_CODE[opts.hand ?? "active"];
    VRModuleOpenXR?.triggerHaptic?.(viewTag, hand, opts.amplitude ?? 0.6, opts.durationSec ?? 0.03);
}
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
export function setPassthroughStyle(viewTag, style) {
    const opacity = style.opacity ?? 1;
    const [r, g, b, a] = style.edgeColor ?? [0, 0, 0, 0];
    VRModuleOpenXR?.setPassthroughStyle?.(viewTag, opacity, r, g, b, a);
}
/**
 * Typed reference to the VRModuleOpenXR native module.
 * undefined when this build does not include the Android OpenXR module (no-op calls are safe via optional chaining).
 */
export const VRModuleOpenXR = NativeModules.VRModuleOpenXR ?? undefined;
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
export function useVRViewTag() {
    const [tag, setTag] = useState(() => VRQuestNavigatorBridge.getViewTag());
    useEffect(() => VRQuestNavigatorBridge.onViewTag(setTag), []);
    return tag;
}
function captureFailure(errorCode) {
    return { success: false, url: null, errorCode };
}
/**
 * Screen capture on the Quest navigator, by view tag, with the same arguments
 * and results as ViroARSceneNavigator's. What the VR scene navigator and the
 * Quest branch of ViroXRSceneNavigator hand scenes as
 * `sceneNavigator.takeScreenshot` / `startVideoRecording` / `stopVideoRecording`.
 *
 * Off Quest (iOS, visionOS, Cardboard on Android) there is no VRModuleOpenXR
 * and every call reports `RECORD_ERROR_UNSUPPORTED_PLATFORM`. A null tag —
 * the VR scene has not mounted — reports `RECORD_ERROR_NOT_READY`, as native
 * does while the XR session has no swapchains.
 *
 * The capture is the left eye, sized to its swapchain. Passthrough is
 * composited by the OS beneath the app's layer, so a mixed-reality capture
 * holds the virtual content only, over black.
 */
export const VRCapture = {
    takeScreenshot(viewTag, fileName, saveToCameraRoll) {
        const fn = VRModuleOpenXR?.takeScreenshot;
        if (typeof fn !== "function") {
            return Promise.resolve(captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM));
        }
        if (viewTag == null) {
            return Promise.resolve(captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY));
        }
        return fn(viewTag, fileName, saveToCameraRoll);
    },
    startVideoRecording(viewTag, fileName, saveToCameraRoll, onError) {
        const fn = VRModuleOpenXR?.startVideoRecording;
        if (typeof fn !== "function") {
            onError?.(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
            return;
        }
        if (viewTag == null) {
            onError?.(ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY);
            return;
        }
        // Native invokes the callback on failure only; a caller without one still
        // records, it just cannot hear why a recording failed.
        fn(viewTag, fileName, saveToCameraRoll, onError ?? (() => { }));
    },
    stopVideoRecording(viewTag) {
        const fn = VRModuleOpenXR?.stopVideoRecording;
        if (typeof fn !== "function") {
            return Promise.resolve(captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM));
        }
        if (viewTag == null) {
            return Promise.resolve(captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY));
        }
        return fn(viewTag);
    },
};
/**
 * The same three calls for a navigator that can never capture — the generic
 * ViroSceneNavigator, which visionOS and iOS VR host. They report
 * `RECORD_ERROR_UNSUPPORTED_PLATFORM` rather than leaving a scene written for
 * AR or Quest to call something undefined.
 */
export const unsupportedCapture = {
    takeScreenshot: (_fileName, _saveToCameraRoll) => Promise.resolve(captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)),
    startVideoRecording: (_fileName, _saveToCameraRoll, onError) => {
        onError?.(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
    },
    stopVideoRecording: () => Promise.resolve(captureFailure(ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)),
};
