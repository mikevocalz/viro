"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireNitroCanvas = requireNitroCanvas;
let cached = null;
function requireNitroCanvas() {
    if (cached)
        return cached;
    try {
        cached = require("nitro-canvas-in-Vision");
    }
    catch {
        throw new Error("nitro-canvas-in-Vision is not installed. ViroRivePanel needs it; no other Viro component does.");
    }
    return cached;
}
