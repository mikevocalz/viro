/**
 * Compatibility facade for Meta VR Layout SDK spatial windows.
 *
 * The Meta packages stay optional peers. On Android, when they are installed,
 * this delegates to Meta's compatibility layer, which handles Horizon OS
 * spatial placement and inline/drop fallback on unsupported Android hosts.
 * On iOS, visionOS and web, or if the optional peers are absent, Viro applies
 * the same fallback semantics locally.
 */
import * as React from "react";
import { Platform } from "react-native";
import { isMetaHorizonXR } from "../Utilities/ViroPlatform";
let modules;
let warned = false;
function loadMetaSpatialModules() {
    if (modules !== undefined)
        return modules;
    if (Platform.OS !== "android" || !isMetaHorizonXR) {
        modules = null;
        return modules;
    }
    try {
        const layout = require("@metavr/layout-compat");
        const window = require("@metavr/layout-window-compat");
        modules = { layout, window };
    }
    catch {
        modules = null;
    }
    return modules;
}
function fallbackNode(children, fallback = "inline") {
    return fallback === "drop"
        ? null
        : React.createElement(React.Fragment, null, children);
}
let windowScene;
function defaultWindowScene(window) {
    // The initializer's native type must not change while mounted, so reuse one.
    windowScene ??= window.createWindowScene?.();
    return windowScene;
}
export function getViroSpatialLayoutSupport() {
    const resolved = loadMetaSpatialModules();
    return {
        platform: Platform.OS,
        basePackageAvailable: !!resolved?.layout?.SpatialSceneProvider,
        windowPackageAvailable: !!resolved?.window?.SpatialWindow,
        nativeSpatialLayoutAvailable: Platform.OS === "android" &&
            isMetaHorizonXR &&
            !!resolved?.layout?.SpatialSceneProvider &&
            !!resolved?.window?.SpatialWindow,
    };
}
export function ViroSpatialSceneProvider(props) {
    const { children, ...rest } = props;
    const resolved = loadMetaSpatialModules();
    if (!resolved?.layout?.SpatialSceneProvider) {
        return React.createElement(React.Fragment, null, children);
    }
    // Meta's provider throws "does not allow configless initialization" without
    // an initializer, so default to the Window scene that SpatialWindow needs.
    const initializer = rest.initializer ?? defaultWindowScene(resolved.window);
    return React.createElement(resolved.layout.SpatialSceneProvider, { ...rest, initializer }, children);
}
export function ViroSpatialWindow(props) {
    const { children, fallback = "inline", label, windowWidth, windowHeight, ...rest } = props;
    const resolved = loadMetaSpatialModules();
    if (!resolved?.window?.SpatialWindow) {
        if (Platform.OS === "android" && isMetaHorizonXR && !warned) {
            warned = true;
            console.warn("[Viro] Meta spatial windows requested without the optional Meta VR Layout SDK. " +
                "Install @metavr/layout-compat and @metavr/layout-window-compat as direct app dependencies, " +
                "then enable android.metaSpatialLayout in the Viro Expo plugin.");
        }
        return fallbackNode(children, fallback);
    }
    return React.createElement(resolved.window.SpatialWindow, { ...rest, label, windowWidth, windowHeight, fallback }, children);
}
