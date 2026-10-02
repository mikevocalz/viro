import { NativeModules } from "react-native";
import {
  queryViroEngineContract,
  type ViroEngineContractInfo,
  type ViroEngineContractNativeModule,
  type ViroEngineDomain,
  type ViroEngineBackendPreference,
  viroEngineDomainCode,
  viroEnginePreferenceCode,
  viroEnginePreferenceFromCode,
} from "./ViroEngineContract";

/**
 * Public bridge entry point.
 *
 * The normalization/compatibility logic stays dependency-injected in
 * ViroEngineContract.ts. This file is the only place that binds it to React
 * Native's NativeModules surface.
 */
export async function getViroEngineContractInfo(): Promise<ViroEngineContractInfo> {
  const nativeModule = NativeModules.ViroEngineContract as
    | ViroEngineContractNativeModule
    | null
    | undefined;
  try {
    return await queryViroEngineContract(nativeModule);
  } catch {
    // The JS package may be newer than the bundled renderer AAR/framework.
    // Treat a missing/older platform bridge exactly like an absent module.
    return queryViroEngineContract(null);
  }
}


function getNativeEngineContractModule(): ViroEngineContractNativeModule | null {
  return (NativeModules.ViroEngineContract as
    | ViroEngineContractNativeModule
    | null
    | undefined) ?? null;
}

export async function setViroEngineBackendPreference(
  domain: ViroEngineDomain,
  preference: ViroEngineBackendPreference
): Promise<boolean> {
  const nativeModule = getNativeEngineContractModule();
  if (typeof nativeModule?.setBackendPreference !== "function") return false;
  try {
    const status = await nativeModule.setBackendPreference(
      viroEngineDomainCode(domain),
      viroEnginePreferenceCode(preference)
    );
    return status === 0;
  } catch {
    return false;
  }
}

export async function getViroEngineBackendPreference(
  domain: ViroEngineDomain
): Promise<ViroEngineBackendPreference> {
  const nativeModule = getNativeEngineContractModule();
  if (typeof nativeModule?.getBackendPreference !== "function") return "auto";
  try {
    return viroEnginePreferenceFromCode(
      await nativeModule.getBackendPreference(viroEngineDomainCode(domain))
    );
  } catch {
    return "auto";
  }
}
