"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isViroSpecsRuntime = isViroSpecsRuntime;
exports.getViroXRRuntime = getViroXRRuntime;
exports.hasViroXRRuntimeCapability = hasViroXRRuntimeCapability;
const react_native_1 = require("react-native");
function readSpecsGlobal() {
    return globalThis;
}
function isViroSpecsRuntime() {
    return readSpecsGlobal().__VIRO_SPECS_BUILD__ === true;
}
function getViroXRRuntime() {
    if (isViroSpecsRuntime()) {
        return {
            kind: "specs",
            isSpecs: true,
            isViroCore: false,
            capabilities: {
                ...(readSpecsGlobal().__VIRO_SPECS_CAPABILITIES__ ?? {}),
            },
        };
    }
    const visionOS = react_native_1.Platform.isVision === true ||
        react_native_1.NativeModules.VRTVisionOSModule?.isVisionOS === true;
    if (visionOS) {
        return {
            kind: "visionos",
            isSpecs: false,
            isViroCore: true,
            capabilities: {},
        };
    }
    if (typeof navigator !== "undefined" && typeof document !== "undefined") {
        return {
            kind: "web",
            isSpecs: false,
            isViroCore: false,
            capabilities: {},
        };
    }
    return {
        kind: "virocore",
        isSpecs: false,
        isViroCore: true,
        capabilities: {},
    };
}
function hasViroXRRuntimeCapability(capability, accepted = ["supported"]) {
    const state = getViroXRRuntime().capabilities[capability] ?? "unverified";
    return accepted.includes(state);
}
