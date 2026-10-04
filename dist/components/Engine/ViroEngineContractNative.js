"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViroEngineContractInfo = getViroEngineContractInfo;
exports.setViroEngineBackendPreference = setViroEngineBackendPreference;
exports.getViroEngineBackendPreference = getViroEngineBackendPreference;
const react_native_1 = require("react-native");
const ViroEngineContract_1 = require("./ViroEngineContract");
/**
 * Public bridge entry point.
 *
 * The normalization/compatibility logic stays dependency-injected in
 * ViroEngineContract.ts. This file is the only place that binds it to React
 * Native's NativeModules surface.
 */
async function getViroEngineContractInfo() {
    const nativeModule = react_native_1.NativeModules.ViroEngineContract;
    try {
        return await (0, ViroEngineContract_1.queryViroEngineContract)(nativeModule);
    }
    catch {
        // The JS package may be newer than the bundled renderer AAR/framework.
        // Treat a missing/older platform bridge exactly like an absent module.
        return (0, ViroEngineContract_1.queryViroEngineContract)(null);
    }
}
function getNativeEngineContractModule() {
    return react_native_1.NativeModules.ViroEngineContract ?? null;
}
async function setViroEngineBackendPreference(domain, preference) {
    const nativeModule = getNativeEngineContractModule();
    if (typeof nativeModule?.setBackendPreference !== "function")
        return false;
    try {
        const status = await nativeModule.setBackendPreference((0, ViroEngineContract_1.viroEngineDomainCode)(domain), (0, ViroEngineContract_1.viroEnginePreferenceCode)(preference));
        return status === 0;
    }
    catch {
        return false;
    }
}
async function getViroEngineBackendPreference(domain) {
    const nativeModule = getNativeEngineContractModule();
    if (typeof nativeModule?.getBackendPreference !== "function")
        return "auto";
    try {
        return (0, ViroEngineContract_1.viroEnginePreferenceFromCode)(await nativeModule.getBackendPreference((0, ViroEngineContract_1.viroEngineDomainCode)(domain)));
    }
    catch {
        return "auto";
    }
}
