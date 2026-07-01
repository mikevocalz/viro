/** True iff the device is a Meta Quest (1, 2, Pro, 3, 3S). */
export declare const isQuest: boolean;
/**
 * True iff the device is a PICO standalone headset (Neo / 4 / 4 Ultra).
 * Re-exported here because viro's `ViroXRSceneNavigator` consumes the
 * flag to take a PICO-specific routing branch (render
 * `ViroVRSceneNavigator` inline since on PICO the MainActivity is
 * itself the immersive Activity — no separate VRActivity needed).
 * `@expo-pico/core` still owns app-level PICO config (manifest,
 * launcher intent-filters, etc.).
 */
export declare const isPico: boolean;
/**
 * True iff the device is any standalone OpenXR-class headset (Quest
 * or PICO). Use for branches that gate "render through the headset
 * compositor; skip the ARCore code path." Vendor-specific routing
 * belongs in the vendor-specific `isQuest` / `isPico` branches.
 */
export declare const isXRHeadset: boolean;
/**
 * True when this app build includes the OpenXR VR native module (i.e. the
 * Quest variant of react-viro is registered in `MainApplication`). Does NOT
 * imply the current device is a Quest — for that, use `isQuest`.
 *
 * Useful when you need to decide whether `ViroVRSceneNavigator` *could* render
 * if you forced VR mode (e.g., for in-app build diagnostics).
 */
export declare const hasOpenXRSupport: boolean;
