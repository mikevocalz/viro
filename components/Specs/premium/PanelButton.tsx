import * as React from "react";
import type { ViroSpecsButtonAuthoredState } from "../core/manifest";
import { ViroFlexView } from "../../ViroFlexView";
import { ViroNode } from "../../ViroNode";
import { ViroText } from "../../ViroText";
import type { PremiumBaseProps } from "./PremiumBaseProps";
import { premiumButtonColors, premiumFontSize, premiumMeters, premiumTokens } from "./premiumTokens";

/** Props of {@linkcode PanelButton}. */
export interface PanelButtonProps extends PremiumBaseProps {
  /** Visible text and accessible name. Required. */
  readonly label: string;
  /**
   * App-controlled state. Hover and pressed come from the host.
   * @default "idle"
   */
  readonly state?: ViroSpecsButtonAuthoredState;
  /** Short reason shown under the button in the `error` state (see `docs/ux/copy.md`). */
  readonly errorMessage?: string;
  /** Fires on release inside the target. Not called while `disabled` or `loading`. */
  readonly onPress?: () => void;
  readonly onHover?: (isHovering: boolean) => void;
  /** Width in meters. @default fitted to the label */
  readonly width?: number;
  readonly height?: number;
  /** Content drawn on the button face, such as a PanelImage on a list card. */
  readonly children?: React.ReactNode;
}

/**
 * Button with the seven token states from `docs/ux/spatial-tokens.md`:
 * idle, hover, pressed, selected, disabled, loading and error. The app sets
 * idle, selected, disabled, loading and error through `state`; the host
 * drives hover and pressed from interaction phases.
 */
export function PanelButton({ label, state = "idle", errorMessage, onPress, onHover, width, height, children, viroTag, ...transform }: PanelButtonProps): React.ReactElement {
  const colors = premiumButtonColors(state);
  const labelHeight = premiumMeters(premiumTokens.type.labelDeg);
  const h = height ?? labelHeight * premiumTokens.type.lineHeight + 2 * premiumMeters(premiumTokens.space.smDeg);
  const w = width ?? Math.max(h * 2.5, label.length * 0.55 * labelHeight + 2 * premiumMeters(premiumTokens.space.mdDeg));
  const inert = state === "disabled" || state === "loading";
  return (
    <ViroNode viroTag={viroTag} accessibilityLabel={label} {...transform}>
      <ViroFlexView
        width={w}
        height={h}
        style={{ backgroundColor: colors.fill }}
        onClick={inert || onPress === undefined ? undefined : () => onPress()}
        onHover={inert || onHover === undefined ? undefined : (isHovering: boolean) => onHover(isHovering)}
      />
      <ViroText
        text={state === "loading" ? "Working" : state === "selected" ? label + " ✓" : state === "error" ? "! " + label : label}
        position={[0, 0, 0.001]}
        width={w}
        height={h}
        style={{ fontSize: premiumFontSize("label"), fontWeight: "500", color: colors.text, textAlign: "center", textAlignVertical: "center" }}
      />
      {state === "error" && errorMessage !== undefined ? (
        <ViroText
          text={errorMessage}
          position={[0, -h, 0.001]}
          width={w * 2}
          height={labelHeight * premiumTokens.type.lineHeight * 2}
          style={{ fontSize: premiumFontSize("label"), color: premiumTokens.color.error, textAlign: "center" }}
        />
      ) : null}
      {children}
    </ViroNode>
  );
}
