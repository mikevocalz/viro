/**
 * Web implementation of ViroBox — a node with box geometry. Dimensions are read
 * on mount; live dimension changes (rebuilding geometry) are a follow-up.
 */
import * as React from "react";
import { useViroNode } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";
export function ViroBox(props) {
    const width = props.width ?? 1;
    const height = props.height ?? 1;
    const length = props.length ?? 1;
    const node = useViroNode(props, (scene) => scene.createBox(width, height, length));
    return (<ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>);
}
