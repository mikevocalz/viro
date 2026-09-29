jest.mock("react-native", () => ({
  NativeModules: {
    VRTSceneNavigatorModule: {
      project: jest.fn(async (_tag, point) => point),
      unproject: jest.fn(async (_tag, point) => point),
    },
  },
}));
jest.mock("../components/Utilities/VRModuleOpenXR", () => ({
  VRModuleOpenXR: { recenterTracking: jest.fn() },
}));
import { NativeModules } from "react-native";
import { VRModuleOpenXR } from "../components/Utilities/VRModuleOpenXR";
import { VRQuestNavigatorBridge as bridge } from "../components/Utilities/VRQuestNavigatorBridge";
import { createXRNavigatorProxy } from "../components/Utilities/XRNavigatorProxy";

afterEach(() => {
  bridge.setViewTag(null);
  jest.clearAllMocks();
});
test("a retained proxy follows the live native view across VR re-entry", async () => {
  const proxy = createXRNavigatorProxy();
  bridge.setViewTag(7);
  await proxy.project([1, 2, 3]);
  bridge.setViewTag(19);
  await proxy.unproject([4, 5, 6]);
  proxy.recenterTracking();
  expect(NativeModules.VRTSceneNavigatorModule.project).toHaveBeenCalledWith(
    7,
    [1, 2, 3]
  );
  expect(NativeModules.VRTSceneNavigatorModule.unproject).toHaveBeenCalledWith(
    19,
    [4, 5, 6]
  );
  expect(VRModuleOpenXR?.recenterTracking).toHaveBeenCalledWith(19);
});
test("new intents invalidate stale tags and reject projection until mounted", async () => {
  bridge.setViewTag(7);
  bridge.setIntent({ scene: () => null });
  await expect(createXRNavigatorProxy().project([0, 0, 0])).rejects.toThrow(
    "not mounted"
  );
});
