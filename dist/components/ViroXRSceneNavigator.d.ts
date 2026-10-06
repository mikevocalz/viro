import * as React from "react";
/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator` (rendered inline)
 *  - **Apple Vision Pro** → opens the visionOS ImmersiveSpace and renders the scene
 *    through `ViroSceneNavigator`. Unlike Quest, the ImmersiveSpace shares this
 *    React runtime, so the scene tree stays mounted here rather than being forwarded.
 *  - **Meta Quest** → launches VRActivity via `VRLauncher.launchVRScene()` and
 *    forwards all navigator operations (push/pop/etc.) to the
 *    `ViroVRSceneNavigator` running there via `VRQuestNavigatorBridge`.
 *    Render output is null — VRActivity owns the display.
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 *
 * Renderer flags (`hdrEnabled`, `pbrEnabled`, `bloomEnabled`, `shadowsEnabled`,
 * Screen capture is on the same `sceneNavigator` everywhere:
 * `takeScreenshot(fileName, saveToCameraRoll)` and `stopVideoRecording()`
 * resolve `{ success, url, errorCode }`, and `startVideoRecording(fileName,
 * saveToCameraRoll, onError)` reports failures to `onError`. On Quest the
 * ref's `sceneNavigator` and the scene's own forward to VRModuleOpenXR, which
 * captures the left eye without the passthrough room and reports
 * `RECORD_ERROR_NOT_READY` until the XR session is rendering. visionOS has
 * no capture, and reports `RECORD_ERROR_UNSUPPORTED_PLATFORM`.
 *
 * `multisamplingEnabled`) reach ViroARSceneNavigator as props and
 * ViroVRSceneNavigator on Quest via the intent bridge. visionOS gets neither:
 * ViroSceneNavigator does not take them. `passthroughEnabled`, `vrModeEnabled`
 * and `handTrackingEnabled` are Quest-only and go over the bridge alone.
 */
export declare const ViroXRSceneNavigator: React.ForwardRefExoticComponent<any>;
