"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVisionOS = exports.hasOpenXRSupport = exports.isXRHeadset = exports.isPico = exports.isQuest = exports.isWeb = void 0;
const react_native_1 = require("react-native");
/**
 * True when running on the web platform (react-native-web). Web uses the
 * WASM/WebGL2 renderer via @reactvision/viro-web-renderer and the .web.tsx
 * bridge instead of the native view managers.
 */
exports.isWeb = react_native_1.Platform.OS === "web";
/**
 * Per-vendor headset detection. Both use `Platform.constants`
 * (Android `Build.MANUFACTURER`, `BRAND`, `MODEL`) — branding strings
 * are the authoritative "what is the user wearing right now" signal.
 * `NativeModules.*` presence is not — vendor-specific modules ship in
 * the same APK that targets phones too.
 *
 *   Quest 1/2/Pro:  Manufacturer="Oculus", Brand="oculus"
 *   Quest 3/3S:     Manufacturer="Meta",   Brand="meta"
 *   PICO 4 / 4U:    Manufacturer="Pico",   Brand="Pico"
 */
function readBuildInfo() {
    const c = (react_native_1.Platform.constants ?? {});
    return {
        manufacturer: (c.Manufacturer ?? "").toLowerCase(),
        brand: (c.Brand ?? "").toLowerCase(),
        model: (c.Model ?? "").toLowerCase(),
    };
}
function detectQuest() {
    if (react_native_1.Platform.OS !== "android")
        return false;
    const { manufacturer, brand, model } = readBuildInfo();
    if (manufacturer === "oculus" ||
        manufacturer === "meta" ||
        brand === "oculus" ||
        brand === "meta") {
        return true;
    }
    return /\bquest\b/.test(model);
}
function detectPico() {
    if (react_native_1.Platform.OS !== "android")
        return false;
    const { manufacturer, brand, model } = readBuildInfo();
    if (manufacturer === "pico" || brand === "pico")
        return true;
    if (model === "a9210" || model === "a92y0" || model === "b3110" || model === "sparrow")
        return true;
    return /\bpico\b/.test(model);
}
/** True iff the device is a Meta Quest (1, 2, Pro, 3, 3S). */
exports.isQuest = detectQuest();
/**
 * True iff the device is a PICO standalone headset (Neo / 4 / 4 Ultra).
 * Re-exported here because viro's `ViroXRSceneNavigator` consumes the
 * flag to route through the shared VRActivity bridge. MainActivity
 * remains the 2D panel surface on both PICO and Quest.
 * `@expo-pico/core` still owns app-level PICO config (manifest,
 * launcher intent-filters, etc.).
 */
exports.isPico = detectPico();
/**
 * True iff the device is any standalone OpenXR-class headset (Quest
 * or PICO). Use for branches that gate "render through the headset
 * compositor; skip the ARCore code path." Vendor-specific routing
 * belongs in the vendor-specific `isQuest` / `isPico` branches.
 */
exports.isXRHeadset = exports.isQuest || exports.isPico;
/**
 * True when this app build includes the OpenXR VR native module (i.e. the
 * Quest variant of react-viro is registered in `MainApplication`). Does NOT
 * imply the current device is a Quest — for that, use `isQuest`.
 *
 * Useful when you need to decide whether `ViroVRSceneNavigator` *could* render
 * if you forced VR mode (e.g., for in-app build diagnostics).
 */
exports.hasOpenXRSupport = react_native_1.NativeModules.VRModuleOpenXR !== undefined;
/**
 * True on Apple Vision Pro (visionOS).
 *
 * Sits here next to `isQuest` and `isWeb` so platform branching reads the same way everywhere.
 * `Platform.OS` is `"ios"` on visionOS — react-native-visionos is an out-of-tree platform that
 * keeps the iOS identity — so it cannot be used to tell the two apart. React Native 0.83+ sets
 * `Platform.isVision`; the native module constant covers builds where it is absent.
 *
 * `ViroVisionOSModule.isVisionOS()` computes the same thing and remains the public API; this is
 * the constant form, evaluated once at import, matching `isQuest`.
 */
function detectVisionOS() {
    if (react_native_1.Platform.isVision === true)
        return true;
    return react_native_1.NativeModules.VRTVisionOSModule?.isVisionOS === true;
}
exports.isVisionOS = detectVisionOS();
