/**
 * Classify Android XR hardware from Android Build facts without coupling Viro
 * to a single product generation.
 *
 * Meta VR Glasses belong to the Meta Horizon/OpenXR runtime family even though
 * they are not Quest. Horizon compatibility mode can intentionally report a
 * Quest-compatible Android identity on newer hardware, so this classifier is
 * only for routing/diagnostics; runtime capabilities remain authoritative.
 */
export function classifyAndroidXRBuild(info) {
    const manufacturer = (info.manufacturer ?? "").trim().toLowerCase();
    const brand = (info.brand ?? "").trim().toLowerCase();
    const model = (info.model ?? "").trim().toLowerCase();
    const isPico = manufacturer === "pico" ||
        brand === "pico" ||
        model === "a9210" ||
        model === "a92y0" ||
        model === "sparrow" ||
        /\bpico\b/.test(model);
    if (isPico) {
        return { vendor: "pico", metaFormFactor: null };
    }
    const isKnownQuest = manufacturer === "oculus" ||
        brand === "oculus" ||
        /\bquest\b/.test(model);
    const isMetaHorizon = isKnownQuest || manufacturer === "meta" || brand === "meta";
    if (isMetaHorizon) {
        return {
            vendor: "meta-horizon",
            metaFormFactor: isKnownQuest ? "quest" : "unknown",
        };
    }
    return { vendor: null, metaFormFactor: null };
}
