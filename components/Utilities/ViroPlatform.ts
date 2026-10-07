import { NativeModules, Platform } from "react-native";
import {
  classifyAndroidXRBuild,
  type MetaHorizonFormFactor,
} from "./ViroXRRuntime";

/** True when running through react-native-web. */
export const isWeb: boolean = Platform.OS === "web";

type AndroidBuildInfo = {
  Manufacturer?: string;
  Brand?: string;
  Model?: string;
};

function readBuildInfo(): { manufacturer: string; brand: string; model: string } {
  const c = (Platform.constants ?? {}) as AndroidBuildInfo;
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
export const isAndroidXR: boolean =
  NativeModules.VRModuleOpenXR?.isAndroidXR === true;

const classified =
  Platform.OS === "android"
    ? classifyAndroidXRBuild(readBuildInfo())
    : { vendor: null, metaFormFactor: null };

// Build strings identify Meta/PICO; Android XR has no build signature — the
// PackageManager feature is its identity. When both agree on a vendor the
// vendor wins (a Horizon-compat runtime still reports Meta).
const androidXR =
  classified.vendor === null && isAndroidXR
    ? { vendor: "android-xr" as const, metaFormFactor: null }
    : classified;

/** True for Android XR devices in the Meta Horizon OS / OpenXR family. */
export const isMetaHorizonXR: boolean = androidXR.vendor === "meta-horizon";

/**
 * Best-effort *reported* Meta form factor. Horizon compatibility mode can make
 * newer hardware report an older Quest identity, so never use this value as a
 * physical-device or feature-capability guarantee.
 */
export const metaHorizonFormFactor: MetaHorizonFormFactor | null =
  androidXR.vendor === "meta-horizon" ? androidXR.metaFormFactor : null;

/**
 * True when Android reports a Quest-compatible identity. Meta VR Glasses may
 * also report a Quest model while Horizon compatibility mode is active.
 * Do not use this flag for feature gating; query the needed capability instead.
 */
export const isKnownQuest: boolean =
  isMetaHorizonXR && metaHorizonFormFactor === "quest";

/**
 * @deprecated Use isMetaHorizonXR for immersive routing. `isKnownQuest` and
 * model strings are diagnostic only because Horizon compatibility mode can
 * report a Quest identity on newer devices. Kept broad for backwards compatibility.
 */
export const isQuest: boolean = isMetaHorizonXR;

/** True for PICO standalone OpenXR hardware. */
export const isPico: boolean = androidXR.vendor === "pico";

/** True on Android XR hardware (declared above, before classification). */

/** True when Viro should use its Android OpenXR immersive path. */
export const isXRHeadset: boolean = isMetaHorizonXR || isPico || isAndroidXR;

/** Build capability, not device identity. */
export const hasOpenXRSupport: boolean =
  NativeModules.VRModuleOpenXR !== undefined;

function detectVisionOS(): boolean {
  if ((Platform as any).isVision === true) return true;
  return NativeModules.VRTVisionOSModule?.isVisionOS === true;
}

export const isVisionOS: boolean = detectVisionOS();
