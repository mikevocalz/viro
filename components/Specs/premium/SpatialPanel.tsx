import * as React from "react";
import { ViroFlexView } from "../../ViroFlexView";
import { ViroNode } from "../../ViroNode";
import { ViroText } from "../../ViroText";
import type { PremiumBaseProps } from "./PremiumBaseProps";
import { premiumFontSize, premiumMeters, premiumTokens } from "./premiumTokens";

/** Props of {@linkcode SpatialPanel}. */
export interface SpatialPanelProps extends PremiumBaseProps {
  /** Title drawn at `type.title`. */
  readonly title?: string;
  /** Width in meters. @default 20 degrees at 1.5 m (0.53 m) */
  readonly width?: number;
  /** Height in meters. @default 12 degrees at 1.5 m */
  readonly height?: number;
  readonly children?: React.ReactNode;
}

/**
 * A dark, mostly opaque panel with a border and padding from the spatial
 * tokens. In a Specs scene it compiles to a `panel` node with a
 * `spatial-panel` component; the Lens host draws the surface. It faces the
 * wearer when placed and does not billboard.
 */
export function SpatialPanel({ title, width, height, children, label, viroTag, ...transform }: SpatialPanelProps): React.ReactElement {
  const w = width ?? premiumMeters(20);
  const h = height ?? premiumMeters(12);
  return (
    <ViroNode viroTag={viroTag} accessibilityLabel={label} {...transform}>
      <ViroFlexView
        width={w}
        height={h}
        style={{ backgroundColor: premiumTokens.color.surface }}
        opacity={premiumTokens.opacity.surface}
      />
      {title !== undefined ? (
        <ViroText
          text={title}
          position={[0, h / 2 - premiumMeters(premiumTokens.space.mdDeg + premiumTokens.type.titleDeg / 2), 0.001]}
          width={w - 2 * premiumMeters(premiumTokens.space.mdDeg)}
          height={premiumMeters(premiumTokens.type.titleDeg * premiumTokens.type.lineHeight)}
          style={{ fontSize: premiumFontSize("title"), fontWeight: "600", color: premiumTokens.color.text }}
        />
      ) : null}
      {children}
    </ViroNode>
  );
}
