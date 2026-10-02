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
  return queryViroEngineContract(nativeModule);
}
