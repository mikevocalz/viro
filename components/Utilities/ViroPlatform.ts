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

/** Best-effort Meta form factor. Unknown is preferred over guessing. */
export const metaHorizonFormFactor: MetaHorizonFormFactor | null =
  androidXR.vendor === "meta-horizon" ? androidXR.metaFormFactor : null;

/** True only for Meta hardware we can positively identify as Quest. */
export const isKnownQuest: boolean =
  isMetaHorizonXR && metaHorizonFormFactor === "quest";

/**
 * @deprecated Use isMetaHorizonXR for immersive routing or isKnownQuest when
 * product-line identity matters. Kept broad for backwards compatibility.
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
