import { VIRO_SPECS_TEXT_EM_METERS_PER_POINT } from "../core/experience";
import type { ViroSpecsButtonAuthoredState, ViroSpecsTextRole } from "../core/manifest";
import { specsAngleToMeters, VIRO_SPECS_SPATIAL_TOKENS } from "../core/tokens";

const tokens = VIRO_SPECS_SPATIAL_TOKENS;

/** Meters for an angular token at the default distance, for the ViroCore rendering. */
export function premiumMeters(angleDeg: number): number {
  return specsAngleToMeters(angleDeg, tokens.distance.defaultMeters);
}

/** Font size in points for a type role at the default distance. */
export function premiumFontSize(role: ViroSpecsTextRole): number {
  const deg = role === "title" ? tokens.type.titleDeg : role === "body" ? tokens.type.bodyDeg : tokens.type.labelDeg;
  return Math.ceil((premiumMeters(deg) / VIRO_SPECS_TEXT_EM_METERS_PER_POINT) * 10) / 10;
}

/** Fill and border colors of a PanelButton state, from the token table. */
export function premiumButtonColors(state: ViroSpecsButtonAuthoredState): {
  readonly fill: string;
  readonly border: string;
  readonly text: string;
} {
  switch (state) {
    case "idle":
    case "loading":
      return { fill: tokens.color.surfaceRaised, border: tokens.color.border, text: tokens.color.text };
    case "selected":
      return { fill: tokens.color.selectedFill, border: tokens.color.focus, text: tokens.color.text };
    case "disabled":
      return { fill: tokens.color.surface, border: tokens.color.border, text: tokens.color.textDisabled };
    case "error":
      return { fill: tokens.color.surfaceRaised, border: tokens.color.error, text: tokens.color.text };
  }
}

export { tokens as premiumTokens };
