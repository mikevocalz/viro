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

const androidXR =
  Platform.OS === "android"
    ? classifyAndroidXRBuild(readBuildInfo())
    : { vendor: null, metaFormFactor: null };

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

/** True when Viro should use its Android OpenXR immersive path. */
export const isXRHeadset: boolean = isMetaHorizonXR || isPico;

/** Build capability, not device identity. */
export const hasOpenXRSupport: boolean =
  NativeModules.VRModuleOpenXR !== undefined;

function detectVisionOS(): boolean {
  if ((Platform as any).isVision === true) return true;
  return NativeModules.VRTVisionOSModule?.isVisionOS === true;
}

export const isVisionOS: boolean = detectVisionOS();
