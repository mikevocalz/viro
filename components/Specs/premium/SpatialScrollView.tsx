import * as React from "react";
import { ViroNode } from "../../ViroNode";
import type { PremiumBaseProps } from "./PremiumBaseProps";

/** Props of {@linkcode SpatialScrollView}. */
export interface SpatialScrollViewProps extends PremiumBaseProps {
  /** Viewport width in meters. */
  readonly width: number;
  /** Viewport height in meters. Content outside it is clipped, never faded. */
  readonly height: number;
  /** Row height in meters; one scroll step. */
  readonly itemHeight: number;
  /** Row shown first when no position has been kept yet. @default 0 */
  readonly initialIndex?: number;
  readonly children?: React.ReactNode;
}

/**
 * Vertical list that scrolls inside a fixed viewport. On Specs the host uses
 * native scrolling and keeps the scroll position for this `viroTag` across
 * updates and navigation, so give it a stable `viroTag`. On ViroCore it
 * renders its children without scrolling.
 */
export function SpatialScrollView({ children, width: _width, height: _height, itemHeight: _itemHeight, initialIndex: _initialIndex, label, viroTag, ...transform }: SpatialScrollViewProps): React.ReactElement {
  return (
    <ViroNode viroTag={viroTag} accessibilityLabel={label} {...transform}>
      {children}
    </ViroNode>
  );
}
