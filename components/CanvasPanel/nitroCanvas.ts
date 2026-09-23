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

let cached: typeof NitroCanvas | null = null;

export function requireNitroCanvas(): typeof NitroCanvas {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("nitro-canvas-in-Vision") as typeof NitroCanvas;
  } catch {
    throw new Error(
      "nitro-canvas-in-Vision is not installed. ViroGpuPanel, ViroThreeJSPanel " +
        "and ViroRivePanel need it; no other Viro component does.",
    );
  }
  return cached;
}
