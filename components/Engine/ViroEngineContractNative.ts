import { NativeModules } from "react-native";
import {
  queryViroEngineContract,
  type ViroEngineContractInfo,
  type ViroEngineContractNativeModule,
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
