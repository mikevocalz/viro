/**
 * Web bridge contexts. The renderer host (Viro3DSceneNavigator.web) provides the
 * ViroWebRenderer; each node component provides its own handle as the parent for
 * its children, so the React tree maps onto the native scene graph.
 */
import { createContext, useContext } from "react";
import { ViroTrackingState, } from "@reactvision/viro-web-renderer";
export const ViroRendererContext = createContext(null);
export const ViroARContext = createContext({
    session: null,
    anchors: [],
    trackingState: ViroTrackingState.Unavailable,
});
export function useViroAR() {
    return useContext(ViroARContext);
}
export const ViroARPlaneClaimsContext = createContext(null);
/** The parent node handle for the current subtree (0 = scene root not yet available). */
export const ViroParentNodeContext = createContext(0);
export function useViroRenderer() {
    const renderer = useContext(ViroRendererContext);
    if (!renderer) {
        throw new Error("Viro web components must be rendered inside a Viro scene navigator (no renderer in context).");
    }
    return renderer;
}
export function useViroScene() {
    return useViroRenderer().scene;
}
export function useViroParentNode() {
    return useContext(ViroParentNodeContext);
}
