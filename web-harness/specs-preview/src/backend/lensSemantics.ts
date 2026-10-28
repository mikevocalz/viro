/**
 * Constants the Lens host uses, copied from
 * `@viro-external/specs/lens/ViroSpecsLensSceneBackend.ts`. The preview
 * scene graph is in Lens units (centimeters) so a transform read from the
 * preview can be compared with the Lens SceneObject directly.
 *
 * `test/lensSemantics.test.ts` reads the Lens backend source from the vendor
 * record's commit and fails when one of these drifts.
 */

import { VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE } from "../vendor/lens-core/ViroSpecsExperienceTokens";

/** Manifest meters to Lens centimeters. */
export const CM_PER_METER = 100;

/** Lens Text `size` for a node without `fontSize`. */
export const DEFAULT_TEXT_SIZE = 48;

/** Lens Text `size` per Viro `fontSize` point. */
export const TEXT_SIZE_PER_POINT = 1;

/**
 * Layout-rect height in centimeters per Lens Text size unit per line: the
 * Lens backend sizes a `maxLines` text box with it. It is a box size, not
 * the glyph size; see {@linkcode TEXT_EM_CM_PER_SIZE}.
 */
export const LINE_HEIGHT_CM_PER_SIZE = 0.1;

/**
 * Glyph em height in centimeters per Lens Text size unit: a size of 43.886
 * draws a 1 cm em (the type scale the experience tokens and the compiler use,
 * `VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE`).
 */
export const TEXT_EM_CM_PER_SIZE = VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE * CM_PER_METER;

/**
 * Line advance in ems. Lens Text line spacing is not documented; 1.2 is the
 * preview's assumption.
 */
export const LINE_ADVANCE_EMS = 1.2;

/** Half extents of the Lens Text layout rect when the node has no extents, in cm. */
export const DEFAULT_TEXT_HALF_WIDTH_CM = 36;
export const DEFAULT_TEXT_HALF_HEIGHT_CM = 4;

/** RGBA of the missing-asset box. */
export const PLACEHOLDER_TINT: readonly [number, number, number, number] = [0.55, 0.6, 0.7, 0.6];

/** Viro light intensity that maps to Lens intensity 1. */
export const LUMENS_PER_LENS_INTENSITY = 1000;

/**
 * Uniform scale a Lens GLB prefab instantiates with: one glTF meter becomes
 * 100 Lens centimeters (ls-clad lens-api, "GLB scale rule").
 */
export const GLB_PREFAB_SCALE = 100;

/**
 * Native size of a Lens Image quad before extents scale it, in cm. The Lens
 * backend scales the surface by `extents / localAabb`, so with extents the
 * result does not depend on this value. Without extents the quad keeps its
 * native size, which the preview takes as -1..1. Not validated in Lens Studio.
 */
export const IMAGE_NATIVE_SIZE_CM = 2;

/** Cubic-bezier control points the Lens animation runtime uses per easing name. */
export const EASING_CONTROL_POINTS = {
  linear: [0, 0, 1, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;
