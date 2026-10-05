let cached = null;
export function requireNitroCanvas() {
    if (cached)
        return cached;
    try {
        cached = require("nitro-canvas-in-Vision");
    }
    catch {
        throw new Error("nitro-canvas-in-Vision is not installed. ViroGpuPanel, ViroThreeJSPanel " +
            "and ViroRivePanel need it; no other Viro component does.");
    }
    return cached;
}
