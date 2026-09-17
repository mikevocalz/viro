import { NativeModules } from "react-native";
import type { Viro3DPoint } from "../Types/ViroUtils";
import { VRQuestNavigatorBridge } from "./VRQuestNavigatorBridge";
import { VRModuleOpenXR } from "./VRModuleOpenXR";

/** Quest and PICO share VRActivity, including its live native view tag. */
export function createXRNavigatorProxy() {
  const requireTag = (): number => {
    const tag = VRQuestNavigatorBridge.getViewTag();
    if (tag == null) throw new Error("[Viro] OpenXR scene is not mounted yet.");
    return tag;
  };
  const project = async (
    method: "project" | "unproject",
    point: Viro3DPoint
  ) => {
    const tag = requireTag();
    const module = NativeModules.VRTSceneNavigatorModule;
    if (typeof module?.[method] !== "function") {
      throw new Error(
        `[Viro] Native ${method} is unavailable. Rebuild the Viro bridge.`
      );
    }
    return module[method](tag, point) as Promise<Viro3DPoint>;
  };
  return {
    push: (scene: any) =>
      VRQuestNavigatorBridge.dispatchOp({ type: "push", scene }),
    replace: (scene: any) =>
      VRQuestNavigatorBridge.dispatchOp({ type: "replace", scene }),
    jump: (scene: any) =>
      VRQuestNavigatorBridge.dispatchOp({ type: "jump", scene }),
    pop: () => VRQuestNavigatorBridge.dispatchOp({ type: "pop" }),
    popN: (n: number) => VRQuestNavigatorBridge.dispatchOp({ type: "popN", n }),
    recenterTracking: () => {
      const tag = requireTag();
      if (!VRModuleOpenXR?.recenterTracking) {
        throw new Error(
          "[Viro] Native recenterTracking is unavailable. Rebuild the Viro bridge."
        );
      }
      VRModuleOpenXR.recenterTracking(tag);
    },
    project: (point: Viro3DPoint) => project("project", point),
    unproject: (point: Viro3DPoint) => project("unproject", point),
  };
}
