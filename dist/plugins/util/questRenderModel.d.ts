/**
 * Meta XR_FB_render_model (the runtime's own controller GLB) needs this
 * permission and feature in the app manifest. They used to sit in the
 * viro_renderer AAR manifest, which merged them into PICO builds as well, so
 * they are written here, only for a QUEST xRMode. Without them the renderer
 * draws its bundled fallback controller mesh.
 */
export declare const RENDER_MODEL_PERMISSION = "com.oculus.permission.RENDER_MODEL";
export declare const RENDER_MODEL_FEATURE = "com.oculus.feature.RENDER_MODEL";
type ManifestEntry = {
    $?: Record<string, string>;
};
type ManifestRoot = {
    "uses-permission"?: ManifestEntry[];
    "uses-feature"?: ManifestEntry[];
};
/**
 * Adds the RENDER_MODEL permission and optional feature to `manifest` when
 * `xrModes` includes "QUEST" and `enabled` is not false. Idempotent.
 */
export declare function addQuestRenderModelEntries(manifest: ManifestRoot, xrModes: readonly string[], enabled: boolean | undefined): ManifestRoot;
export {};
