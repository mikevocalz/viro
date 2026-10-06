/**
 * The gaze reticle, as a scene-navigator prop.
 *
 * The WASM renderer draws VROReticle at the centre of the canvas on every frame.
 * In a headset that dot is how you aim. On web the user aims with a mouse or a
 * finger, so the dot only covers the middle of the scene. Web therefore hides
 * it unless a caller asks for it with `showReticle`.
 *
 * The switch is viroSetReticleVisible, which virocore added after the published
 * renderer 1.0.1. Against an older WASM the prop does nothing and the reticle
 * stays as the renderer drew it.
 */
import { useEffect } from "react";
/** Returns false when the loaded WASM has no reticle switch. */
export function setViroReticleVisible(renderer, visible) {
    const module = renderer.wasmModule;
    if (typeof module?.viroSetReticleVisible !== "function")
        return false;
    module.viroSetReticleVisible(visible);
    return true;
}
export function useViroReticle(renderer, { showReticle = false }) {
    useEffect(() => {
        if (!renderer)
            return;
        setViroReticleVisible(renderer, showReticle);
    }, [renderer, showReticle]);
}
