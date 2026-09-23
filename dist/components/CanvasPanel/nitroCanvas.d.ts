/**
 * Lazy, optional access to `nitro-canvas-in-Vision`.
 *
 * Only the three canvas panels (ViroGpuPanel, ViroThreeJSPanel, ViroRivePanel)
 * need that package, and it is not on npm. A top-level `import` from it made
 * Metro fail the whole bundle for every consumer of this package, panel or
 * not. A `require` inside `try` is an optional dependency to Metro
 * (`resolver.allowOptionalDependencies`, on by default), so the bundle builds
 * without the package and only a mounted panel finds out it is missing.
 */
import type * as NitroCanvas from "nitro-canvas-in-Vision";
export declare function requireNitroCanvas(): typeof NitroCanvas;
