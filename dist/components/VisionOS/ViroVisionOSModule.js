/**
 * ViroVisionOSModule
 *
 * JavaScript API for controlling the visionOS ImmersiveSpace.
 * On iOS / Android the calls are no-ops (module returns false / resolves silently).
 *
 * ── Host-app setup required ──────────────────────────────────────────────────
 *
 * 1. Add the ImmersiveSpace to your SwiftUI App struct (visionOS only):
 *
 *    #if os(visionOS)
 *    import ViroReact
 *    #endif
 *
 *    @main struct MyApp: App {
 *      var body: some Scene {
 *        WindowGroup {
 *          ContentView()
 *            #if os(visionOS)
 *            .viroImmersiveSpaceController()
 *            #endif
 *        }
 *        #if os(visionOS)
 *        ImmersiveSpace(id: "ViroImmersive") {
 *          ViroImmersiveSpaceView()
 *        }
 *        .immersionStyle(selection: .constant(.mixed), in: .mixed, .full)
 *        #endif
 *      }
 *    }
 *
 * 2. Call from JavaScript:
 *
 *    import { ViroVisionOSModule } from '@reactvision/react-viro';
 *
 *    await ViroVisionOSModule.enterImmersiveSpace('mixed');
 *    // ... render Viro scene inside ImmersiveSpace ...
 *    await ViroVisionOSModule.exitImmersiveSpace();
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { NativeEventEmitter, NativeModules, Platform } from "react-native";
/** @internal — raw NativeModule reference */
const { VRTVisionOSModule } = NativeModules;
/**
 * Returns true if the app is running on Apple Vision Pro (visionOS).
 * Uses the native module constant; falls back to Platform.isVision when
 * available (React Native 0.83+).
 */
export function isVisionOS() {
    // React Native 0.83+ exposes Platform.isVision on visionOS builds.
    if (Platform.isVision === true)
        return true;
    // Fallback: check the native module constant.
    return VRTVisionOSModule?.isVisionOS === true;
}
/**
 * Opens the Viro ImmersiveSpace on visionOS.
 *
 * @param style  "mixed" (default) — virtual content blended over passthrough
 *               "full"  — fully virtual, passthrough hidden
 */
export async function enterImmersiveSpace(style = "mixed") {
    if (!VRTVisionOSModule) {
        if (__DEV__) {
            console.warn("[Viro] VRTVisionOSModule not available on this platform");
        }
        return false;
    }
    return VRTVisionOSModule.enterImmersiveSpace(style);
}
/**
 * Dismisses the Viro ImmersiveSpace and returns to the window layer.
 */
export async function exitImmersiveSpace() {
    if (!VRTVisionOSModule)
        return false;
    return VRTVisionOSModule.exitImmersiveSpace();
}
/**
 * Adjusts how the visionOS ray behaves, while the ImmersiveSpace is open.
 *
 * Exists to be called from JavaScript during a session: these numbers can only be judged with a
 * headset on, and a native rebuild is ten minutes. No-op on every other platform.
 */
export function setInputTuning(tuning) {
    VRTVisionOSModule?.setInputTuning?.(tuning);
}
/** Subscribe to spatial-stylus frames; returns an idempotent unsubscribe function. */
export function subscribeSpatialStylus(listener) {
    if (!isVisionOS() || !VRTVisionOSModule)
        return () => undefined;
    const subscription = new NativeEventEmitter(VRTVisionOSModule)
        .addListener("onSpatialStylus", (event) => {
        listener(event);
    });
    let subscribed = true;
    return () => {
        if (!subscribed)
            return;
        subscribed = false;
        subscription.remove();
    };
}
export const ViroVisionOSModule = {
    isVisionOS,
    enterImmersiveSpace,
    exitImmersiveSpace,
    subscribeSpatialStylus,
};
const NOT_SUPPORTED = {
    supported: false,
    sharing: false,
    participants: 0,
};
/**
 * Current shared-space state.
 *
 * Unlike a cloud anchor or a Meta spatial anchor, there is no frame to locate
 * here: ARKit aligns the **world origin itself**, so once `sharing` is true,
 * world coordinates already mean the same thing on every participant.
 */
export async function sharedSpaceState() {
    if (!VRTVisionOSModule?.sharedSpaceState)
        return NOT_SUPPORTED;
    return VRTVisionOSModule.sharedSpaceState();
}
/**
 * Alignment data to deliver to the other participants, base64-encoded, or null
 * when there is nothing new to send.
 *
 * ARKit does not move this data itself — it emits blobs and expects them
 * delivered, by any transport. Poll this and ship whatever it returns; the
 * receiving device passes it to {@link sharedSpacePushIncoming}. Until both
 * sides do that, `sharing` never becomes true.
 */
export async function sharedSpaceNextOutgoing() {
    if (!VRTVisionOSModule?.sharedSpaceNextOutgoing)
        return null;
    return VRTVisionOSModule.sharedSpaceNextOutgoing();
}
/** Hand ARKit base64 alignment data received from another participant. */
export async function sharedSpacePushIncoming(base64) {
    if (!VRTVisionOSModule?.sharedSpacePushIncoming)
        return false;
    return VRTVisionOSModule.sharedSpacePushIncoming(base64);
}
