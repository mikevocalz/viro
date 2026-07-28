import { NativeModules, Platform } from "react-native";

type AndroidBuildInfo = {
  Manufacturer?: string;
  Brand?: string;
  Model?: string;
};

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
function readBuildInfo(): { manufacturer: string; brand: string; model: string } {
  const c = (Platform.constants ?? {}) as AndroidBuildInfo;
  return {
    manufacturer: (c.Manufacturer ?? "").toLowerCase(),
    brand: (c.Brand ?? "").toLowerCase(),
    model: (c.Model ?? "").toLowerCase(),
  };
}

function detectQuest(): boolean {
  if (Platform.OS !== "android") return false;
  const { manufacturer, brand, model } = readBuildInfo();
  if (
    manufacturer === "oculus" ||
    manufacturer === "meta" ||
    brand === "oculus" ||
    brand === "meta"
  ) {
    return true;
  }
  return /\bquest\b/.test(model);
}

function detectPico(): boolean {
  if (Platform.OS !== "android") return false;
  const { manufacturer, brand, model } = readBuildInfo();
  if (manufacturer === "pico" || brand === "pico") return true;
  if (model === "a9210" || model === "a92y0" || model === "sparrow") return true;
  return /\bpico\b/.test(model);
}

/** True iff the device is a Meta Quest (1, 2, Pro, 3, 3S). */
export const isQuest: boolean = detectQuest();

/**
 * True iff the device is a PICO standalone headset (Neo / 4 / 4 Ultra).
 * Re-exported here because viro's `ViroXRSceneNavigator` consumes the
 * flag to take a PICO-specific routing branch (render
 * `ViroVRSceneNavigator` inline since on PICO the MainActivity is
 * itself the immersive Activity — no separate VRActivity needed).
 * `@expo-pico/core` still owns app-level PICO config (manifest,
 * launcher intent-filters, etc.).
 */
export const isPico: boolean = detectPico();

/**
 * True iff the device is any standalone OpenXR-class headset (Quest
 * or PICO). Use for branches that gate "render through the headset
 * compositor; skip the ARCore code path." Vendor-specific routing
 * belongs in the vendor-specific `isQuest` / `isPico` branches.
 */
export const isXRHeadset: boolean = isQuest || isPico;

/**
 * True when this app build includes the OpenXR VR native module (i.e. the
 * Quest variant of react-viro is registered in `MainApplication`). Does NOT
 * imply the current device is a Quest — for that, use `isQuest`.
 *
 * Useful when you need to decide whether `ViroVRSceneNavigator` *could* render
 * if you forced VR mode (e.g., for in-app build diagnostics).
 */
export const hasOpenXRSupport: boolean =
  NativeModules.VRModuleOpenXR !== undefined;
