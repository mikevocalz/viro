import { NativeModules } from "react-native";
import { queryViroEngineContract, viroEngineDomainCode, viroEnginePreferenceCode, viroEnginePreferenceFromCode, } from "./ViroEngineContract";
/**
 * Public bridge entry point.
 *
 * The normalization/compatibility logic stays dependency-injected in
 * ViroEngineContract.ts. This file is the only place that binds it to React
 * Native's NativeModules surface.
 */
export async function getViroEngineContractInfo() {
    const nativeModule = NativeModules.ViroEngineContract;
    try {
        return await queryViroEngineContract(nativeModule);
    }
    catch {
        // The JS package may be newer than the bundled renderer AAR/framework.
        // Treat a missing/older platform bridge exactly like an absent module.
        return queryViroEngineContract(null);
    }
}
function getNativeEngineContractModule() {
    return NativeModules.ViroEngineContract ?? null;
}
export async function setViroEngineBackendPreference(domain, preference) {
    const nativeModule = getNativeEngineContractModule();
    if (typeof nativeModule?.setBackendPreference !== "function")
        return false;
    try {
        const status = await nativeModule.setBackendPreference(viroEngineDomainCode(domain), viroEnginePreferenceCode(preference));
        return status === 0;
    }
    catch {
        return false;
    }
}
export async function getViroEngineBackendPreference(domain) {
    const nativeModule = getNativeEngineContractModule();
    if (typeof nativeModule?.getBackendPreference !== "function")
        return "auto";
    try {
        return viroEnginePreferenceFromCode(await nativeModule.getBackendPreference(viroEngineDomainCode(domain)));
    }
    catch {
        return "auto";
    }
}
