/**
 * Web implementation of ViroPortalScene — a VROPortal node holding the content
 * seen through a portal entrance. Its `<ViroPortal>` child defines the doorway;
 * other children are the content rendered inside the portal.
 *
 * MVP scope: passable + transform + children. `onPortalEnter/Exit` (requires
 * passability/collision events) are follow-ups.
 */
import * as React from "react";
import { useEffect } from "react";
import { useViroNode } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";
export function ViroPortalScene(props) {
    const scene = useViroScene();
    const node = useViroNode(props, undefined, true, undefined, (s) => s.createPortalScene());
    useEffect(() => {
        scene.setPortalPassable(node, props.passable ?? false);
    }, [scene, node, props.passable]);
    return (<ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>);
}
