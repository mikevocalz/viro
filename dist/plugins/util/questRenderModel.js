"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENDER_MODEL_FEATURE = exports.RENDER_MODEL_PERMISSION = void 0;
exports.addQuestRenderModelEntries = addQuestRenderModelEntries;
/**
 * Meta XR_FB_render_model (the runtime's own controller GLB) needs this
 * permission and feature in the app manifest. They used to sit in the
 * viro_renderer AAR manifest, which merged them into PICO builds as well, so
 * they are written here, only for a QUEST xRMode. Without them the renderer
 * draws its bundled fallback controller mesh.
 */
exports.RENDER_MODEL_PERMISSION = "com.oculus.permission.RENDER_MODEL";
exports.RENDER_MODEL_FEATURE = "com.oculus.feature.RENDER_MODEL";
const hasEntry = (entries, name) => entries.some((entry) => entry.$?.["android:name"] === name);
/**
 * Adds the RENDER_MODEL permission and optional feature to `manifest` when
 * `xrModes` includes "QUEST" and `enabled` is not false. Idempotent.
 */
function addQuestRenderModelEntries(manifest, xrModes, enabled) {
    if (!xrModes.includes("QUEST") || enabled === false) {
        return manifest;
    }
    const permissions = (manifest["uses-permission"] ??= []);
    const features = (manifest["uses-feature"] ??= []);
    if (!hasEntry(permissions, exports.RENDER_MODEL_PERMISSION)) {
        permissions.push({ $: { "android:name": exports.RENDER_MODEL_PERMISSION } });
    }
    if (!hasEntry(features, exports.RENDER_MODEL_FEATURE)) {
        features.push({
            $: { "android:name": exports.RENDER_MODEL_FEATURE, "android:required": "false" },
        });
    }
    return manifest;
}
