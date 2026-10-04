"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViroSpatialLayoutSupport = getViroSpatialLayoutSupport;
exports.ViroSpatialSceneProvider = ViroSpatialSceneProvider;
exports.ViroSpatialWindow = ViroSpatialWindow;
/**
 * Compatibility facade for Meta VR Layout SDK spatial windows.
 *
 * The Meta packages stay optional peers. On Android, when they are installed,
 * this delegates to Meta's compatibility layer, which handles Horizon OS
 * spatial placement and inline/drop fallback on unsupported Android hosts.
 * On iOS, visionOS and web, or if the optional peers are absent, Viro applies
 * the same fallback semantics locally.
 */
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
let modules;
let warned = false;
function loadMetaSpatialModules() {
    if (modules !== undefined)
        return modules;
    if (react_native_1.Platform.OS !== "android" || !ViroPlatform_1.isMetaHorizonXR) {
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
function getViroSpatialLayoutSupport() {
    const resolved = loadMetaSpatialModules();
    return {
        platform: react_native_1.Platform.OS,
        basePackageAvailable: !!resolved?.layout?.SpatialSceneProvider,
        windowPackageAvailable: !!resolved?.window?.SpatialWindow,
        nativeSpatialLayoutAvailable: react_native_1.Platform.OS === "android" &&
            ViroPlatform_1.isMetaHorizonXR &&
            !!resolved?.layout?.SpatialSceneProvider &&
            !!resolved?.window?.SpatialWindow,
    };
}
function ViroSpatialSceneProvider(props) {
    const { children, ...rest } = props;
    const resolved = loadMetaSpatialModules();
    if (!resolved?.layout?.SpatialSceneProvider) {
        return React.createElement(React.Fragment, null, children);
    }
    return React.createElement(resolved.layout.SpatialSceneProvider, rest, children);
}
function ViroSpatialWindow(props) {
    const { children, fallback = "inline", label, windowWidth, windowHeight, ...rest } = props;
    const resolved = loadMetaSpatialModules();
    if (!resolved?.window?.SpatialWindow) {
        if (react_native_1.Platform.OS === "android" && ViroPlatform_1.isMetaHorizonXR && !warned) {
            warned = true;
            console.warn("[Viro] Meta spatial windows requested without the optional Meta VR Layout SDK. " +
                "Install @metavr/layout-compat and @metavr/layout-window-compat as direct app dependencies, " +
                "then enable android.metaSpatialLayout in the Viro Expo plugin.");
        }
        return fallbackNode(children, fallback);
    }
    return React.createElement(resolved.window.SpatialWindow, { ...rest, label, windowWidth, windowHeight, fallback }, children);
}
