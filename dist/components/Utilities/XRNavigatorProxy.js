"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createXRNavigatorProxy = createXRNavigatorProxy;
const react_native_1 = require("react-native");
const VRQuestNavigatorBridge_1 = require("./VRQuestNavigatorBridge");
const VRModuleOpenXR_1 = require("./VRModuleOpenXR");
/** Quest and PICO share VRActivity, including its live native view tag. */
function createXRNavigatorProxy() {
    const requireTag = () => {
        const tag = VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.getViewTag();
        if (tag == null)
            throw new Error("[Viro] OpenXR scene is not mounted yet.");
        return tag;
    };
    const project = async (method, point) => {
        const tag = requireTag();
        const module = react_native_1.NativeModules.VRTSceneNavigatorModule;
        if (typeof module?.[method] !== "function") {
            throw new Error(`[Viro] Native ${method} is unavailable. Rebuild the Viro bridge.`);
        }
        return module[method](tag, point);
    };
    return {
        push: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "push", scene }),
        replace: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "replace", scene }),
        jump: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "jump", scene }),
        pop: () => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "pop" }),
        popN: (n) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "popN", n }),
        recenterTracking: () => {
            const tag = requireTag();
            if (!VRModuleOpenXR_1.VRModuleOpenXR?.recenterTracking) {
                throw new Error("[Viro] Native recenterTracking is unavailable. Rebuild the Viro bridge.");
            }
            VRModuleOpenXR_1.VRModuleOpenXR.recenterTracking(tag);
        },
        project: (point) => project("project", point),
        unproject: (point) => project("unproject", point),
    };
}
