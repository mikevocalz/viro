/**
 * Web implementation of ViroPortal — the entrance frame (VROPortalFrame) of the
 * enclosing ViroPortalScene. Its children are the doorway geometry (e.g. a
 * Viro3DObject of an arch/door). Registering the entrance parents the frame
 * under the portal scene, so this does not use useViroNode's auto-parenting.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { useDeferredRelease } from "./Web/useDeferredRelease";
import { useViroScene, useViroParentNode, ViroParentNodeContext, } from "./Web/ViroWebContext";
const DEG2RAD = Math.PI / 180;
export function ViroPortal(props) {
    const scene = useViroScene();
    const portalScene = useViroParentNode(); // the enclosing VROPortal
    const [frame] = useState(() => scene.createPortalFrame());
    // Register as the portal scene's entrance (this also parents the frame).
    // Deferred destroy: StrictMode's remount re-registers this same handle.
    const frameRelease = useDeferredRelease();
    useEffect(() => {
        frameRelease.cancel();
        scene.setPortalEntrance(portalScene, frame);
        return () => frameRelease.schedule(() => scene.destroyNode(frame));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [px, py, pz] = props.position ?? [0, 0, 0];
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = props.scale ?? [1, 1, 1];
    useEffect(() => {
        scene.setNodePosition(frame, px, py, pz);
        scene.setNodeRotation(frame, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
        scene.setNodeScale(frame, sx, sy, sz);
    }, [scene, frame, px, py, pz, rx, ry, rz, sx, sy, sz]);
    return (<ViroParentNodeContext.Provider value={frame}>
      {props.children}
    </ViroParentNodeContext.Provider>);
}
