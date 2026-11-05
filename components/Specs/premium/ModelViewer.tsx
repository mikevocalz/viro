import * as React from "react";
import type { ViroSource } from "../../Types/ViroUtils";
import { Viro3DObject } from "../../Viro3DObject";
import type { PremiumBaseProps } from "./PremiumBaseProps";

/** Props of {@linkcode ModelViewer}. */
export interface ModelViewerProps extends PremiumBaseProps {
  readonly source: ViroSource;
  /** Model format. Viro3DObject has no FBX loader; VRX is rejected on Specs (`VS3013`). */
  readonly type: "GLB" | "GLTF" | "OBJ";
  /** Slow turntable rotation; always off under reduced motion. @default false */
  readonly autoRotate?: boolean;
  /** Shows a "Reset model" button that returns the authored transform. @default true */
  readonly resettable?: boolean;
  readonly onClick?: () => void;
  readonly onHover?: (isHovering: boolean) => void;
  /** Drag position in meters. On Specs the host keeps it inside the 0.6-3.0 m band. */
  readonly onDrag?: (position: [number, number, number]) => void;
}

/**
 * A model with load, error, manipulate, animate and reset states. Loading
 * shows a progress ring at the model's origin; a missing model shows a
 * placeholder box with the `error.asset` copy and a Retry action.
 */
export function ModelViewer({ source, type, autoRotate: _autoRotate, resettable: _resettable, onClick, onHover, onDrag, label, viroTag, ...transform }: ModelViewerProps): React.ReactElement {
  return (
    <Viro3DObject
      viroTag={viroTag}
      accessibilityLabel={label}
      source={source}
      type={type}
      {...(onClick !== undefined ? { onClick: () => onClick() } : {})}
      {...(onHover !== undefined ? { onHover: (isHovering: boolean) => onHover(isHovering) } : {})}
      {...(onDrag !== undefined ? { onDrag: (position: [number, number, number]) => onDrag(position) } : {})}
      {...transform}
    />
  );
}
