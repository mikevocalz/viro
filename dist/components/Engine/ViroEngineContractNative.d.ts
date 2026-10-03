import { type ViroEngineContractInfo, type ViroEngineDomain, type ViroEngineBackendPreference } from "./ViroEngineContract";
/**
 * Public bridge entry point.
 *
 * The normalization/compatibility logic stays dependency-injected in
 * ViroEngineContract.ts. This file is the only place that binds it to React
 * Native's NativeModules surface.
 */
export declare function getViroEngineContractInfo(): Promise<ViroEngineContractInfo>;
export declare function setViroEngineBackendPreference(domain: ViroEngineDomain, preference: ViroEngineBackendPreference): Promise<boolean>;
export declare function getViroEngineBackendPreference(domain: ViroEngineDomain): Promise<ViroEngineBackendPreference>;
