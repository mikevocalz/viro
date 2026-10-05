import { NativeModules, Platform } from "react-native";
function readSpecsGlobal() {
    return globalThis;
}
export function isViroSpecsRuntime() {
    return readSpecsGlobal().__VIRO_SPECS_BUILD__ === true;
}
export function getViroXRRuntime() {
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
    const visionOS = Platform.isVision === true ||
        NativeModules.VRTVisionOSModule?.isVisionOS === true;
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
export function hasViroXRRuntimeCapability(capability, accepted = ["supported"]) {
    const state = getViroXRRuntime().capabilities[capability] ?? "unverified";
    return accepted.includes(state);
}
