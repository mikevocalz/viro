/**
 * android.openxr: startup render quality for the OpenXR renderer (Quest and
 * PICO), written to AndroidManifest meta-data that ViroViewOpenXR reads when it
 * creates its session. See virocore docs/API_RENDER_QUALITY.md.
 */

/**
 * Fixed-foveation level for XR_FB_foveation. Higher levels render the edge of
 * each eye at lower resolution. Used by {@link OpenXRFoveationOptions.level}.
 */
export type OpenXRFoveationLevel = "off" | "low" | "medium" | "high";

/**
 * The foveation the OpenXR session starts with. Used by
 * {@link OpenXRRenderQualityOptions.foveation}.
 */
export interface OpenXRFoveationOptions {
  /** Starting level. */
  level: OpenXRFoveationLevel;
  /**
   * Let the runtime lower the level when the GPU has headroom.
   *
   * @default true
   */
  dynamic?: boolean;
}

/**
 * Startup render quality for the OpenXR renderer, set as `android.openxr` in
 * the Viro config plugin options. Requires `android.xRMode` to include
 * `"QUEST"` or `"PICO"`. Both fields are read once, when the OpenXR session
 * starts; there is no JS API to change them at runtime.
 */
export interface OpenXRRenderQualityOptions {
  /**
   * Per-axis multiplier on the runtime's recommended eye-buffer size, from
   * {@link OPENXR_EYE_BUFFER_SCALE_MIN} to {@link OPENXR_EYE_BUFFER_SCALE_MAX}.
   * The renderer also clamps each axis to the runtime's maximum eye-buffer
   * size, and logs the size it chose per eye.
   *
   * Written to AndroidManifest as com.viro.openxr.eyeBufferScale.
   *
   * @default 1.3
   */
  eyeBufferScale?: number;
  /**
   * Starting foveation. Written as com.viro.openxr.foveationLevel and, when
   * `dynamic` is set, com.viro.openxr.foveationDynamic.
   *
   * @default { level: "low", dynamic: true }
   */
  foveation?: OpenXRFoveationOptions;
}

/** Manifest key for {@link OpenXRRenderQualityOptions.eyeBufferScale}. */
export const OPENXR_EYE_BUFFER_SCALE_META = "com.viro.openxr.eyeBufferScale";
/** Manifest key for {@link OpenXRFoveationOptions.level}. */
export const OPENXR_FOVEATION_LEVEL_META = "com.viro.openxr.foveationLevel";
/** Manifest key for {@link OpenXRFoveationOptions.dynamic}. */
export const OPENXR_FOVEATION_DYNAMIC_META = "com.viro.openxr.foveationDynamic";

/**
 * Smallest accepted {@link OpenXRRenderQualityOptions.eyeBufferScale}. 1.0 is
 * the recommended size; the renderer never renders below it.
 */
export const OPENXR_EYE_BUFFER_SCALE_MIN = 1;
/**
 * Largest accepted {@link OpenXRRenderQualityOptions.eyeBufferScale}. A sanity
 * bound against typos: 3x per axis is 9x the pixels. Runtimes clamp lower.
 */
export const OPENXR_EYE_BUFFER_SCALE_MAX = 3;

const FOVEATION_LEVELS: readonly OpenXRFoveationLevel[] = ["off", "low", "medium", "high"];
const OPENXR_XR_MODES = ["QUEST", "PICO"];

/** One `<meta-data>` entry to write under `<application>`. */
export interface OpenXRMetaDataEntry {
  name: string;
  value: string;
}

function describe(value: unknown): string {
  return typeof value === "number" ? String(value) : JSON.stringify(value);
}

function fail(message: string): never {
  throw new Error(`[Viro] ${message}`);
}

/**
 * Validate `android.openxr` and return the manifest meta-data it produces, in
 * a fixed order. Returns `[]` when no field is set.
 *
 * @throws Error naming the field when a value is out of range or has the wrong
 *   type, or when `xrModes` has no OpenXR mode (`"QUEST"` or `"PICO"`).
 */
export function resolveOpenXRRenderQualityMetaData(
  options: OpenXRRenderQualityOptions | undefined,
  xrModes: readonly string[]
): OpenXRMetaDataEntry[] {
  if (options === undefined || options === null) {
    return [];
  }
  const entries: OpenXRMetaDataEntry[] = [];
  const { eyeBufferScale, foveation } = options;

  if (eyeBufferScale !== undefined) {
    if (
      typeof eyeBufferScale !== "number" ||
      !Number.isFinite(eyeBufferScale) ||
      eyeBufferScale < OPENXR_EYE_BUFFER_SCALE_MIN ||
      eyeBufferScale > OPENXR_EYE_BUFFER_SCALE_MAX
    ) {
      fail(
        `android.openxr.eyeBufferScale must be a number from ${OPENXR_EYE_BUFFER_SCALE_MIN} ` +
          `to ${OPENXR_EYE_BUFFER_SCALE_MAX}, got ${describe(eyeBufferScale)}. ` +
          "Omit it for the 1.3 default."
      );
    }
    entries.push({ name: OPENXR_EYE_BUFFER_SCALE_META, value: String(eyeBufferScale) });
  }

  if (foveation !== undefined) {
    if (foveation === null || typeof foveation !== "object") {
      fail('android.openxr.foveation must be an object such as { level: "low" }.');
    }
    if (!FOVEATION_LEVELS.includes(foveation.level)) {
      fail(
        `android.openxr.foveation.level must be "off" | "low" | "medium" | "high", ` +
          `got ${describe(foveation.level)}.`
      );
    }
    entries.push({ name: OPENXR_FOVEATION_LEVEL_META, value: foveation.level });
    if (foveation.dynamic !== undefined) {
      if (typeof foveation.dynamic !== "boolean") {
        fail(
          `android.openxr.foveation.dynamic must be true or false, got ${describe(foveation.dynamic)}.`
        );
      }
      entries.push({ name: OPENXR_FOVEATION_DYNAMIC_META, value: String(foveation.dynamic) });
    }
  }

  if (entries.length > 0 && !xrModes.some((mode) => OPENXR_XR_MODES.includes(mode))) {
    fail(
      'android.openxr requires android.xRMode to include "QUEST" or "PICO"; ' +
        "no other mode uses the OpenXR renderer."
    );
  }
  return entries;
}

/** The meta-data names {@link resolveOpenXRRenderQualityMetaData} can write. */
export const OPENXR_RENDER_QUALITY_META_NAMES: readonly string[] = [
  OPENXR_EYE_BUFFER_SCALE_META,
  OPENXR_FOVEATION_LEVEL_META,
  OPENXR_FOVEATION_DYNAMIC_META,
];
