/**
 * Android XR uses the same activity-hosted OpenXR scene as Quest and PICO.
 * These tests exercise the public navigator with native boundaries mocked;
 * they do not claim that an Android XR session rendered on a device.
 */
let mockRuntime: "android-xr" | "quest" | "pico" | "phone" | "visionos" = "android-xr";
const mockLaunch = jest.fn();
const mockRequestPermissions = jest.fn();
const mockProject = jest.fn();
const mockUnproject = jest.fn();
const mockRecenter = jest.fn();
const mockAppStateListeners = new Set<(state: string) => void>();

jest.mock("react-native", () => ({
  NativeModules: {
    VRLauncher: { launchVRScene: () => mockLaunch() },
    VRTSceneNavigatorModule: {
      project: (...args: unknown[]) => mockProject(...args),
      unproject: (...args: unknown[]) => mockUnproject(...args),
    },
    VRModuleOpenXR: {
      recenterTracking: (...args: unknown[]) => mockRecenter(...args),
    },
  },
  PermissionsAndroid: {
    requestMultiple: (...args: unknown[]) => mockRequestPermissions(...args),
  },
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListeners.add(listener);
      return { remove: () => mockAppStateListeners.delete(listener) };
    },
  },
  DeviceEventEmitter: { addListener: () => ({ remove: () => {} }) },
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
}));

jest.mock("../components/Utilities/ViroPlatform", () => ({
  get isMetaHorizonXR() { return mockRuntime === "quest"; },
  get isPico() { return mockRuntime === "pico"; },
  get isAndroidXR() { return mockRuntime === "android-xr"; },
  get isXRHeadset() {
    return mockRuntime === "quest" || mockRuntime === "pico" || mockRuntime === "android-xr";
  },
  get isVisionOS() { return mockRuntime === "visionos"; },
}));
jest.mock("../components/AR/ViroARSceneNavigator", () => ({
  ViroARSceneNavigator: "PhoneARNavigator",
}));
jest.mock("../components/ViroSceneNavigator", () => ({
  ViroSceneNavigator: "VisionOSSceneNavigator",
}));
jest.mock("../components/Utilities/ViroUsagePing", () => ({
  sendViroUsagePing: jest.fn(),
  ViroUsagePingSuppressed: jest.requireActual("react").createContext(false),
}));
jest.mock("../components/VisionOS/ViroVisionOSModule", () => ({
  enterImmersiveSpace: jest.fn(() => Promise.resolve(true)),
  exitImmersiveSpace: jest.fn(() => Promise.resolve()),
}));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { ViroXRSceneNavigator } from "../components/ViroXRSceneNavigator";
import { VRQuestNavigatorBridge } from "../components/Utilities/VRQuestNavigatorBridge";
import { enterImmersiveSpace } from "../components/VisionOS/ViroVisionOSModule";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AR_SCENE = { scene: () => null as any };
const VR_SCENE = { scene: () => null as any };
let renderer: TestRenderer.ReactTestRenderer | undefined;

async function mount(props: React.ComponentProps<typeof ViroXRSceneNavigator>) {
  await act(async () => {
    renderer = TestRenderer.create(<ViroXRSceneNavigator {...props} />);
  });
  return renderer!;
}

beforeEach(() => {
  mockRuntime = "android-xr";
  jest.clearAllMocks();
  mockRequestPermissions.mockResolvedValue({});
  mockProject.mockResolvedValue([1, 2, 3]);
  mockUnproject.mockResolvedValue([4, 5, 6]);
  mockAppStateListeners.clear();
  VRQuestNavigatorBridge.setVRActive(false);
  VRQuestNavigatorBridge.setViewTag(null);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
});

test("Android XR launches the VR scene through the activity bridge without Meta permission prompts", async () => {
  const tree = await mount({
    arInitialScene: AR_SCENE,
    vrInitialScene: VR_SCENE,
    hdrEnabled: false,
    passthroughEnabled: true,
    trackingOrigin: "floor",
  });

  expect(mockLaunch).toHaveBeenCalledTimes(1);
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(VRQuestNavigatorBridge.getIntent()).toMatchObject({
    initialScene: VR_SCENE,
    rendererConfig: {
      hdrEnabled: false,
      passthroughEnabled: true,
      trackingOrigin: "floor",
    },
  });
  expect(VRQuestNavigatorBridge.isVRActive()).toBe(true);
  expect(tree.root.findAllByType("PhoneARNavigator" as any)).toHaveLength(0);
  expect(tree.root.findAllByType("Pressable" as any)).toHaveLength(1);
});

test("Android XR forwards navigator operations and projection calls to the active immersive scene", async () => {
  const ref = React.createRef<any>();
  await mount({ initialScene: VR_SCENE, ref });
  const received: unknown[] = [];
  const unsubscribe = VRQuestNavigatorBridge.subscribeOps((operation) => received.push(operation));
  const nextScene = { scene: () => null as any };

  ref.current.sceneNavigator.push(nextScene);
  ref.current.sceneNavigator.pop();
  expect(received).toEqual([{ type: "push", scene: nextScene }, { type: "pop" }]);
  expect(ref.current.arSceneNavigator).toBe(ref.current.sceneNavigator);

  VRQuestNavigatorBridge.setViewTag(42);
  await expect(ref.current.sceneNavigator.project([0, 1, -2])).resolves.toEqual([1, 2, 3]);
  await expect(ref.current.sceneNavigator.unproject([0.5, 0.5, 1])).resolves.toEqual([4, 5, 6]);
  ref.current.sceneNavigator.recenterTracking();
  expect(mockProject).toHaveBeenCalledWith(42, [0, 1, -2]);
  expect(mockUnproject).toHaveBeenCalledWith(42, [0.5, 0.5, 1]);
  expect(mockRecenter).toHaveBeenCalledWith(42);
  unsubscribe();
});

test("Android XR reopens only on explicit panel entry and keeps the registered scene", async () => {
  const renderQuestPanel = jest.fn((_enter: () => void) => null);
  await mount({ initialScene: VR_SCENE, renderQuestPanel });
  const intent = VRQuestNavigatorBridge.getIntent();
  VRQuestNavigatorBridge.setVRActive(false);

  act(() => {
    mockAppStateListeners.forEach((listener) => listener("background"));
    mockAppStateListeners.forEach((listener) => listener("active"));
  });
  expect(mockLaunch).toHaveBeenCalledTimes(1);

  act(() => renderQuestPanel.mock.calls[0][0]());
  expect(mockLaunch).toHaveBeenCalledTimes(2);
  expect(VRQuestNavigatorBridge.isVRActive()).toBe(true);
  expect(VRQuestNavigatorBridge.getIntent()).toBe(intent);
});

test("Quest still requests its configured permissions before launch", async () => {
  mockRuntime = "quest";
  await mount({ initialScene: VR_SCENE, questPermissions: ["spatialData"] });

  expect(mockRequestPermissions).toHaveBeenCalledWith([
    "horizonos.permission.USE_ANCHOR_API",
    "com.oculus.permission.USE_SCENE",
  ]);
  expect(mockLaunch).toHaveBeenCalledTimes(1);
});

test("PICO keeps the immersive activity route without requesting Meta permissions", async () => {
  mockRuntime = "pico";
  const tree = await mount({ initialScene: VR_SCENE });

  expect(mockLaunch).toHaveBeenCalledTimes(1);
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("PhoneARNavigator" as any)).toHaveLength(0);
});

test("ordinary Android uses the AR scene inline", async () => {
  mockRuntime = "phone";
  const tree = await mount({ arInitialScene: AR_SCENE, vrInitialScene: VR_SCENE });

  expect(tree.root.findByType("PhoneARNavigator" as any).props.initialScene).toBe(AR_SCENE);
  expect(mockLaunch).not.toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});

test("visionOS retains its own immersive-space route", async () => {
  mockRuntime = "visionos";
  const tree = await mount({ arInitialScene: AR_SCENE, vrInitialScene: VR_SCENE });

  expect(tree.root.findByType("VisionOSSceneNavigator" as any).props.initialScene).toBe(VR_SCENE);
  expect(enterImmersiveSpace).toHaveBeenCalledWith("mixed");
  expect(mockLaunch).not.toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});

test("a pending permission result cannot launch an immersive scene after its navigator unmounts", async () => {
  mockRuntime = "quest";
  let resolvePermission!: (result: object) => void;
  mockRequestPermissions.mockReturnValue(new Promise((resolve) => {
    resolvePermission = resolve;
  }));
  await mount({ initialScene: VR_SCENE });
  await act(async () => renderer!.unmount());
  renderer = undefined;

  await act(async () => resolvePermission({}));
  expect(mockLaunch).not.toHaveBeenCalled();
  expect(VRQuestNavigatorBridge.isVRActive()).toBe(false);
});
