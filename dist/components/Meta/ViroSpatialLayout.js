"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMetaSpatialLayoutAvailable = isMetaSpatialLayoutAvailable;
exports.ViroSpatialSceneProvider = ViroSpatialSceneProvider;
exports.ViroSpatialWindow = ViroSpatialWindow;
const React = require("react");
let sceneModule;
let windowModule;
function loadSceneModule() {
    if (sceneModule !== undefined) return sceneModule;
    try { sceneModule = require("@metavr/layout-compat"); }
    catch { sceneModule = null; }
    return sceneModule;
}
function loadWindowModule() {
    if (windowModule !== undefined) return windowModule;
    try { windowModule = require("@metavr/layout-window-compat"); }
    catch { windowModule = null; }
    return windowModule;
}
function isMetaSpatialLayoutAvailable() {
    return Boolean(loadSceneModule()?.SpatialSceneProvider && loadWindowModule()?.SpatialWindow);
}
function ViroSpatialSceneProvider({ children, ...props }) {
    const Provider = loadSceneModule()?.SpatialSceneProvider;
    if (!Provider) return React.createElement(React.Fragment, null, children);
    return React.createElement(Provider, props, children);
}
function ViroSpatialWindow({ children, fallback = "inline", ...props }) {
    const SpatialWindow = loadWindowModule()?.SpatialWindow;
    if (!SpatialWindow) return fallback === "drop" ? null : React.createElement(React.Fragment, null, children);
    return React.createElement(SpatialWindow, { ...props, fallback }, children);
}
