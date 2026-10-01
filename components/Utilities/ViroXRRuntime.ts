export type MetaHorizonFormFactor = "quest" | "unknown";
export type ViroAndroidXRVendor = "meta-horizon" | "pico" | null;

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
 * they are not Quest. Until stable model identifiers are available for every
 * Meta form factor, unknown Meta hardware deliberately reports
 * metaFormFactor="unknown" and relies on runtime capability negotiation.
 */
export function classifyAndroidXRBuild(
  info: AndroidXRBuildInfo
): AndroidXRClassification {
  const manufacturer = (info.manufacturer ?? "").trim().toLowerCase();
  const brand = (info.brand ?? "").trim().toLowerCase();
  const model = (info.model ?? "").trim().toLowerCase();

  const isPico =
    manufacturer === "pico" ||
    brand === "pico" ||
    model === "a9210" ||
    model === "a92y0" ||
    model === "sparrow" ||
    /\bpico\b/.test(model);

  if (isPico) {
    return { vendor: "pico", metaFormFactor: null };
  }

  const isKnownQuest =
    manufacturer === "oculus" ||
    brand === "oculus" ||
    /\bquest\b/.test(model);

  const isMetaHorizon =
    isKnownQuest || manufacturer === "meta" || brand === "meta";

  if (isMetaHorizon) {
    return {
      vendor: "meta-horizon",
      metaFormFactor: isKnownQuest ? "quest" : "unknown",
    };
  }

  return { vendor: null, metaFormFactor: null };
}
