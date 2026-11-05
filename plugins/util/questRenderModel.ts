/**
 * Meta XR_FB_render_model (the runtime's own controller GLB) needs this
 * permission and feature in the app manifest. They used to sit in the
 * viro_renderer AAR manifest, which merged them into PICO builds as well, so
 * they are written here, only for a QUEST xRMode. Without them the renderer
 * draws its bundled fallback controller mesh.
 */
export const RENDER_MODEL_PERMISSION = "com.oculus.permission.RENDER_MODEL";
export const RENDER_MODEL_FEATURE = "com.oculus.feature.RENDER_MODEL";

type ManifestEntry = { $?: Record<string, string> };
type ManifestRoot = {
  "uses-permission"?: ManifestEntry[];
  "uses-feature"?: ManifestEntry[];
};

const hasEntry = (entries: ManifestEntry[], name: string) =>
  entries.some((entry) => entry.$?.["android:name"] === name);

/**
 * Adds the RENDER_MODEL permission and optional feature to `manifest` when
 * `xrModes` includes "QUEST" and `enabled` is not false. Idempotent.
 */
export function addQuestRenderModelEntries(
  manifest: ManifestRoot,
  xrModes: readonly string[],
  enabled: boolean | undefined
): ManifestRoot {
  if (!xrModes.includes("QUEST") || enabled === false) {
    return manifest;
  }
  const permissions = (manifest["uses-permission"] ??= []);
  const features = (manifest["uses-feature"] ??= []);
  if (!hasEntry(permissions, RENDER_MODEL_PERMISSION)) {
    permissions.push({ $: { "android:name": RENDER_MODEL_PERMISSION } });
  }
  if (!hasEntry(features, RENDER_MODEL_FEATURE)) {
    features.push({
      $: { "android:name": RENDER_MODEL_FEATURE, "android:required": "false" },
    });
  }
  return manifest;
}
