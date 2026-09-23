"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireNitroCanvas = requireNitroCanvas;
let cached = null;
function requireNitroCanvas() {
    if (cached)
        return cached;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cached = require("nitro-canvas-in-Vision");
    }
    catch {
        throw new Error("nitro-canvas-in-Vision is not installed. ViroGpuPanel, ViroThreeJSPanel " +
            "and ViroRivePanel need it; no other Viro component does.");
    }
    return cached;
}
