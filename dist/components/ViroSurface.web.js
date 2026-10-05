/**
 * Web implementation of ViroSurface — a node with a flat quad (surface)
 * geometry. Dimensions are read on mount.
 */
import * as React from "react";
import { useViroNode } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { ViroParentNodeContext } from "./Web/ViroWebContext";
export function ViroSurface(props) {
    // Inside a ViroFlexView the layout decides the size, as it does natively.
    const slot = useViroFlexSlot();
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? 1;
    const node = useViroNode(props, (scene) => scene.createSurface(width, height));
    return (<ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>);
}
