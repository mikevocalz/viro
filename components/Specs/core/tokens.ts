/**
 * Spatial design tokens for the Specs premium components, from
 * `docs/ux/spatial-tokens.md`. The compilers copy them into the manifest
 * (`theme.tokens`) so the Lens host renders from the manifest instead of its
 * own constants.
 *
 * Units are in the field names: `Deg` is angular size at the node's distance,
 * `Meters` is a physical offset or distance, `Ms` is milliseconds. Colors are
 * `#RRGGBB`; opacity is a separate 0-1 field.
 */

/** Color tokens. Contrast ratios are listed in `docs/ux/spatial-tokens.md`. */
export interface ViroSpecsColorTokens {
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfacePressed: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textDisabled: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly focus: string;
  readonly onFocus: string;
  readonly selectedFill: string;
  readonly error: string;
  readonly errorSurface: string;
  readonly degraded: string;
  readonly degradedSurface: string;
  readonly success: string;
  readonly placeholder: string;
}

/** Surface tint drawn under the placement reticle, by surface classification. */
export interface ViroSpecsTintTokens {
  readonly floor: string;
  readonly table: string;
  readonly wall: string;
  readonly seat: string;
  readonly ceiling: string;
  /** Opacity of the tint disc. */
  readonly opacity: number;
}

/** Comfort band from the pack, section 2. */
export interface ViroSpecsDistanceTokens {
  readonly minMeters: number;
  readonly defaultMeters: number;
  readonly maxMeters: number;
}

/** Angular type sizes. Nothing renders below {@linkcode ViroSpecsTypeTokens.minAngleDeg}. */
export interface ViroSpecsTypeTokens {
  readonly minAngleDeg: number;
  readonly titleDeg: number;
  readonly bodyDeg: number;
  readonly labelDeg: number;
  readonly lineHeight: number;
}

/** Angular spacing scale. */
export interface ViroSpecsSpaceTokens {
  readonly xsDeg: number;
  readonly smDeg: number;
  readonly mdDeg: number;
  readonly lgDeg: number;
  readonly xlDeg: number;
}

/** Border widths and corner radii, angular. */
export interface ViroSpecsShapeTokens {
  readonly borderWidthDeg: number;
  readonly borderWidthFocusDeg: number;
  readonly radiusPanelDeg: number;
  readonly radiusButtonDeg: number;
  readonly radiusCardDeg: number;
}

/** Offsets toward the wearer. Depth reads as distance, so these are meters. */
export interface ViroSpecsDepthTokens {
  readonly baseMeters: number;
  readonly raisedMeters: number;
  readonly hoverMeters: number;
  readonly overlayMeters: number;
}

/** Durations and the two scale factors the motion rules use. */
export interface ViroSpecsMotionTokens {
  readonly fastMs: number;
  readonly baseMs: number;
  readonly slowMs: number;
  /** Hard cap from the pack. `VS3019` reports animations above it. */
  readonly maxMs: number;
  /** One loading-ring turn. A continuous indicator, exempt from the cap. */
  readonly progressLoopMs: number;
  /** Panels appear by scaling from this factor to 1. */
  readonly appearScaleFrom: number;
  /** Hovered controls scale to this factor (not in reduced motion). */
  readonly hoverScale: number;
}

/** Opacity of panel surfaces and placeholders. */
export interface ViroSpecsOpacityTokens {
  readonly surface: number;
  readonly placeholder: number;
  readonly disabledBorder: number;
}

/**
 * Input timings and steps. `gazeDwellMs` is provisional: see
 * `docs/specs-experience.md#gaze-dwell` for the sources and the open study.
 */
export interface ViroSpecsInputTokens {
  readonly gazeDwellMs: number;
  readonly lookAwayCancelMs: number;
  /** Step size of the gaze-only Move buttons that replace drag. */
  readonly gazeStepMeters: number;
  /** Reticle diameter at the hit distance. */
  readonly reticleDeg: number;
}

/** Full token set. Read by the Lens host from `theme.tokens`. */
export interface ViroSpecsSpatialTokens {
  readonly distance: ViroSpecsDistanceTokens;
  readonly type: ViroSpecsTypeTokens;
  readonly color: ViroSpecsColorTokens;
  readonly tint: ViroSpecsTintTokens;
  readonly space: ViroSpecsSpaceTokens;
  readonly shape: ViroSpecsShapeTokens;
  readonly depth: ViroSpecsDepthTokens;
  readonly motion: ViroSpecsMotionTokens;
  readonly opacity: ViroSpecsOpacityTokens;
  readonly input: ViroSpecsInputTokens;
}

/** What high-contrast mode replaces. Applied over {@linkcode ViroSpecsSpatialTokens}. */
export interface ViroSpecsHighContrastTokens {
  readonly color: {
    readonly surface: string;
    readonly text: string;
    readonly textMuted: string;
    readonly border: string;
    readonly focus: string;
  };
  readonly surfaceOpacity: number;
  /** Multiplies both border widths. */
  readonly borderScale: number;
  /** Added to every type size. */
  readonly typeBoostDeg: number;
}

/** Wearer preferences that change how tokens and motion apply. */
export interface ViroSpecsExperiencePreferences {
  readonly highContrast: boolean;
  readonly reducedMotion: boolean;
}

/**
 * The `theme` block of a manifest v2. Present whenever a premium component
 * compiled, so the Lens host has every token the components read.
 *
 * @see {@linkcode resolveSpecsTokens}
 */
export interface ViroSpecsTheme {
  /** Token set version. Bumped when a token is renamed or removed. */
  readonly version: 1;
  readonly tokens: ViroSpecsSpatialTokens;
  readonly highContrast: ViroSpecsHighContrastTokens;
  /** Authored defaults. The host may override them at runtime. */
  readonly preferences: ViroSpecsExperiencePreferences;
}

/** Default tokens, copied from `docs/ux/spatial-tokens.md`. */
export const VIRO_SPECS_SPATIAL_TOKENS = {
  distance: { minMeters: 0.6, defaultMeters: 1.5, maxMeters: 3.0 },
  type: { minAngleDeg: 1.2, titleDeg: 2.0, bodyDeg: 1.4, labelDeg: 1.2, lineHeight: 1.3 },
  color: {
    surface: "#1b2630",
    surfaceRaised: "#26343f",
    surfacePressed: "#33444f",
    text: "#eef2f0",
    textMuted: "#a9b6bf",
    textDisabled: "#808d96",
    border: "#6b7d8c",
    borderStrong: "#c4d0d8",
    focus: "#f2b544",
    onFocus: "#14202a",
    selectedFill: "#3b3320",
    error: "#ff8a7a",
    errorSurface: "#3a1f1e",
    degraded: "#9cc8ff",
    degradedSurface: "#1e2c3d",
    success: "#8fd9b6",
    placeholder: "#6b7d8c",
  },
  tint: {
    floor: "#8fd9b6",
    table: "#f2b544",
    wall: "#9cc8ff",
    seat: "#d9a6f2",
    ceiling: "#a9b6bf",
    opacity: 0.35,
  },
  space: { xsDeg: 0.4, smDeg: 0.8, mdDeg: 1.2, lgDeg: 2.0, xlDeg: 3.2 },
  shape: {
    borderWidthDeg: 0.15,
    borderWidthFocusDeg: 0.3,
    radiusPanelDeg: 1.2,
    radiusButtonDeg: 0.8,
    radiusCardDeg: 0.8,
  },
  depth: { baseMeters: 0, raisedMeters: 0.005, hoverMeters: 0.01, overlayMeters: 0.03 },
  motion: {
    fastMs: 120,
    baseMs: 240,
    slowMs: 400,
    maxMs: 500,
    progressLoopMs: 1200,
    appearScaleFrom: 0.96,
    hoverScale: 1.04,
  },
  opacity: { surface: 0.92, placeholder: 0.4, disabledBorder: 0.5 },
  input: { gazeDwellMs: 1000, lookAwayCancelMs: 1500, gazeStepMeters: 0.1, reticleDeg: 2.0 },
} as const satisfies ViroSpecsSpatialTokens;

/** Default high-contrast replacements from `docs/ux/spatial-tokens.md`. */
export const VIRO_SPECS_HIGH_CONTRAST_TOKENS = {
  color: {
    surface: "#000000",
    text: "#ffffff",
    textMuted: "#ffffff",
    border: "#ffffff",
    focus: "#ffd25e",
  },
  surfaceOpacity: 1,
  borderScale: 2,
  typeBoostDeg: 0.2,
} as const satisfies ViroSpecsHighContrastTokens;

/** Preferences when the author sets none. */
export const VIRO_SPECS_DEFAULT_PREFERENCES = {
  highContrast: false,
  reducedMotion: false,
} as const satisfies ViroSpecsExperiencePreferences;

/** The theme the compilers write when the author does not supply one. */
export const VIRO_SPECS_DEFAULT_THEME: ViroSpecsTheme = {
  version: 1,
  tokens: VIRO_SPECS_SPATIAL_TOKENS,
  highContrast: VIRO_SPECS_HIGH_CONTRAST_TOKENS,
  preferences: VIRO_SPECS_DEFAULT_PREFERENCES,
};

/**
 * Applies the preferences to a theme. High contrast swaps the listed colors,
 * makes the surface opaque, scales borders and boosts type; reduced motion
 * sets the appear and hover scales to 1 so nothing scales. Durations are kept:
 * the host swaps transforms for fades under reduced motion, it does not
 * shorten fades.
 */
export function resolveSpecsTokens(
  theme: ViroSpecsTheme,
  preferences: ViroSpecsExperiencePreferences = theme.preferences
): ViroSpecsSpatialTokens {
  const base = theme.tokens;
  const hc = theme.highContrast;
  const color: ViroSpecsColorTokens = preferences.highContrast ? { ...base.color, ...hc.color } : base.color;
  const boost = preferences.highContrast ? hc.typeBoostDeg : 0;
  const borderScale = preferences.highContrast ? hc.borderScale : 1;
  return {
    ...base,
    color,
    type: {
      ...base.type,
      titleDeg: base.type.titleDeg + boost,
      bodyDeg: base.type.bodyDeg + boost,
      labelDeg: base.type.labelDeg + boost,
    },
    shape: {
      ...base.shape,
      borderWidthDeg: base.shape.borderWidthDeg * borderScale,
      borderWidthFocusDeg: base.shape.borderWidthFocusDeg * borderScale,
    },
    opacity: preferences.highContrast ? { ...base.opacity, surface: hc.surfaceOpacity } : base.opacity,
    motion: preferences.reducedMotion ? { ...base.motion, appearScaleFrom: 1, hoverScale: 1 } : base.motion,
  };
}

/**
 * Physical size in meters that subtends `angleDeg` at `distanceMeters`:
 * `2 · d · tan(angle / 2)`. 1.2 degrees at 1.5 m is 3.14 cm.
 */
export function specsAngleToMeters(angleDeg: number, distanceMeters: number): number {
  return 2 * distanceMeters * Math.tan(((angleDeg / 2) * Math.PI) / 180);
}

/** Angle in degrees that `sizeMeters` subtends at `distanceMeters`. */
export function specsMetersToAngle(sizeMeters: number, distanceMeters: number): number {
  if (distanceMeters <= 0) return 180;
  return (2 * Math.atan(sizeMeters / (2 * distanceMeters)) * 180) / Math.PI;
}
