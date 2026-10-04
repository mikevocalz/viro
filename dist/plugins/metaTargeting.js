"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMetaDefaultDeviceTargets = resolveMetaDefaultDeviceTargets;
exports.assertMetaVrGlassesXrMode = assertMetaVrGlassesXrMode;
function resolveMetaDefaultDeviceTargets(options) {
    return (options?.metaDefaultDeviceTargets ??
        (options?.metaVrGlassesCompatible ? "quest3+" : undefined));
}
function assertMetaVrGlassesXrMode(xrModes, options) {
    if (options?.metaVrGlassesCompatible && !xrModes.includes("QUEST")) {
        throw new Error('[Viro] android.metaVrGlassesCompatible requires android.xRMode to include "QUEST" ' +
            '(the existing Meta Horizon/OpenXR build path).');
    }
}
