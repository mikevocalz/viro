import * as React from "react";
import type { ImageSourcePropType } from "react-native";
import { ViroImage } from "../../ViroImage";
import type { PremiumBaseProps } from "./PremiumBaseProps";

/** Props of {@linkcode PanelImage}. */
export interface PanelImageProps extends PremiumBaseProps {
  readonly source: ImageSourcePropType;
  /** Width in meters. Give width and height together. */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Image with `radius.card` corners. When the asset is missing on Specs the
 * host shows a `color.placeholder` box at these extents and reports `VS5003`,
 * labelled "{label}, didn't load".
 */
export function PanelImage({ source, width, height, label, viroTag, ...transform }: PanelImageProps): React.ReactElement {
  return (
    <ViroImage
      viroTag={viroTag}
      accessibilityLabel={label}
      source={source}
      {...(width !== undefined ? { width } : {})}
      {...(height !== undefined ? { height } : {})}
      {...transform}
    />
  );
}
