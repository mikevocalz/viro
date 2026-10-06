"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVisionOS = exports.hasOpenXRSupport = exports.isXRHeadset = exports.isPico = exports.isQuest = exports.isKnownQuest = exports.metaHorizonFormFactor = exports.isMetaHorizonXR = exports.isAndroidXR = exports.isWeb = void 0;
const react_native_1 = require("react-native");
const ViroXRRuntime_1 = require("./ViroXRRuntime");
/** True when running through react-native-web. */
exports.isWeb = react_native_1.Platform.OS === "web";
function readBuildInfo() {
    const c = (react_native_1.Platform.constants ?? {});
    return {
        manufacturer: c.Manufacturer ?? "",
        brand: c.Brand ?? "",
        model: c.Model ?? "",
    };
}
/**
 * True on Android XR (Google runtime — Galaxy XR, XR glasses). Source of truth
 * is the PackageManager feature check VRModuleOpenXR exposes as a native
 * constant; build strings can't see the runtime and are never trusted.
 */
exports.isAndroidXR = react_native_1.NativeModules.VRModuleOpenXR?.isAndroidXR === true;
const classified = react_native_1.Platform.OS === "android"
    ? (0, ViroXRRuntime_1.classifyAndroidXRBuild)(readBuildInfo())
    : { vendor: null, metaFormFactor: null };
// Build strings identify Meta/PICO; Android XR has no build signature — the
// PackageManager feature is its identity. When both agree on a vendor the
// vendor wins (a Horizon-compat runtime still reports Meta).
const androidXR = classified.vendor === null && exports.isAndroidXR
    ? { vendor: "android-xr", metaFormFactor: null }
    : classified;
/** True for Android XR devices in the Meta Horizon OS / OpenXR family. */
exports.isMetaHorizonXR = androidXR.vendor === "meta-horizon";
/**
 * Best-effort *reported* Meta form factor. Horizon compatibility mode can make
 * newer hardware report an older Quest identity, so never use this value as a
 * physical-device or feature-capability guarantee.
 */
exports.metaHorizonFormFactor = androidXR.vendor === "meta-horizon" ? androidXR.metaFormFactor : null;
/**
 * True when Android reports a Quest-compatible identity. Meta VR Glasses may
 * also report a Quest model while Horizon compatibility mode is active.
 * Do not use this flag for feature gating; query the needed capability instead.
 */
exports.isKnownQuest = exports.isMetaHorizonXR && exports.metaHorizonFormFactor === "quest";
/**
 * @deprecated Use isMetaHorizonXR for immersive routing. `isKnownQuest` and
 * model strings are diagnostic only because Horizon compatibility mode can
 * report a Quest identity on newer devices. Kept broad for backwards compatibility.
 */
exports.isQuest = exports.isMetaHorizonXR;
/** True for PICO standalone OpenXR hardware. */
exports.isPico = androidXR.vendor === "pico";
/** True on Android XR hardware (declared above, before classification). */
/** True when Viro should use its Android OpenXR immersive path. */
exports.isXRHeadset = exports.isMetaHorizonXR || exports.isPico || exports.isAndroidXR;
/** Build capability, not device identity. */
exports.hasOpenXRSupport = react_native_1.NativeModules.VRModuleOpenXR !== undefined;
function detectVisionOS() {
    if (react_native_1.Platform.isVision === true)
        return true;
    return react_native_1.NativeModules.VRTVisionOSModule?.isVisionOS === true;
}
exports.isVisionOS = detectVisionOS();
