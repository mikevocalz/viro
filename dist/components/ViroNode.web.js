/**
 * Web implementation of ViroNode — a transform group with no geometry. Creates a
 * native node, applies transform props, and provides its handle as the parent
 * for its children.
 */
import * as React from "react";
import { useViroNode } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";
export function ViroNode(props) {
    const node = useViroNode(props);
    return (<ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>);
}
