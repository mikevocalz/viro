export type MetaHorizonFormFactor = "quest" | "unknown";
export type ViroAndroidXRVendor = "meta-horizon" | "pico" | "android-xr" | null;
export type AndroidXRBuildInfo = {
    manufacturer?: string | null;
    brand?: string | null;
    model?: string | null;
};
export type AndroidXRClassification = {
    vendor: ViroAndroidXRVendor;
    metaFormFactor: MetaHorizonFormFactor | null;
};
/**
 * Classify Android XR hardware from Android Build facts without coupling Viro
 * to a single product generation.
 *
 * Meta VR Glasses belong to the Meta Horizon/OpenXR runtime family even though
 * they are not Quest. Horizon compatibility mode can intentionally report a
 * Quest-compatible Android identity on newer hardware, so this classifier is
 * only for routing/diagnostics; runtime capabilities remain authoritative.
 */
export declare function classifyAndroidXRBuild(info: AndroidXRBuildInfo): AndroidXRClassification;
