/**
 * ViroExternalVideo resolves one native producer class per platform from `sourceClass`, keeps the
 * original string form working as an Android Java class, and degrades through `onError` when the
 * native build has no VRTExternalVideo view instead of mounting a missing view.
 */
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlatform = { OS: "ios" as string };
const mockHasViewManagerConfig = jest.fn<boolean, [string]>();

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatform.OS;
    },
  },
  UIManager: {
    hasViewManagerConfig: (name: string) => mockHasViewManagerConfig(name),
  },
  requireNativeComponent: (name: string) => name,
}));

import {
  resolveExternalVideoSourceClass,
  DEFAULT_ANDROID_EXTERNAL_VIDEO_SOURCE_CLASS,
  DEFAULT_APPLE_EXTERNAL_VIDEO_SOURCE_CLASS,
} from "../components/Utilities/resolveExternalVideoSourceClass";
import {
  ViroExternalVideo,
  VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR,
  resetExternalVideoNativeViewCheck,
} from "../components/ViroExternalVideo";

const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    consoleError(...args);
  });
});

beforeEach(() => {
  mockPlatform.OS = "ios";
  mockHasViewManagerConfig.mockReset();
  mockHasViewManagerConfig.mockReturnValue(true);
  resetExternalVideoNativeViewCheck();
});

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warnSpy.mockRestore();
});

const WEBRTC = {
  android: "com.oney.WebRTCModule.ViroExternalWebRTCFrames",
  apple: "ViroExternalWebRTCFrames",
};

describe("resolveExternalVideoSourceClass", () => {
  it("uses each platform's entry of the object form", () => {
    expect(resolveExternalVideoSourceClass(WEBRTC, "android")).toBe(WEBRTC.android);
    expect(resolveExternalVideoSourceClass(WEBRTC, "ios")).toBe(WEBRTC.apple);
  });

  it("keeps a plain string as the Android Java class", () => {
    expect(resolveExternalVideoSourceClass("com.example.Frames", "android")).toBe(
      "com.example.Frames"
    );
  });

  it("does not hand a Java class name to the Objective-C runtime", () => {
    expect(resolveExternalVideoSourceClass("com.example.Frames", "ios")).toBe(
      DEFAULT_APPLE_EXTERNAL_VIDEO_SOURCE_CLASS
    );
  });

  it("falls back per platform when the class or the entry is missing", () => {
    expect(resolveExternalVideoSourceClass(undefined, "android")).toBe(
      DEFAULT_ANDROID_EXTERNAL_VIDEO_SOURCE_CLASS
    );
    expect(resolveExternalVideoSourceClass(undefined, "ios")).toBe(
      DEFAULT_APPLE_EXTERNAL_VIDEO_SOURCE_CLASS
    );
    expect(resolveExternalVideoSourceClass({ apple: "AppleOnly" }, "android")).toBe(
      DEFAULT_ANDROID_EXTERNAL_VIDEO_SOURCE_CLASS
    );
    expect(resolveExternalVideoSourceClass({ android: "a.B" }, "ios")).toBe(
      DEFAULT_APPLE_EXTERNAL_VIDEO_SOURCE_CLASS
    );
  });
});

function renderHost(props: React.ComponentProps<typeof ViroExternalVideo>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ViroExternalVideo {...props} />);
  });
  return renderer;
}

const HOST = "VRTExternalVideo" as unknown as React.ElementType;

describe("ViroExternalVideo", () => {
  it("sends the Apple class and Apple-only fitting props on iOS", () => {
    const host = renderHost({
      material: "peer",
      sourceKey: "stream-1",
      sourceClass: WEBRTC,
    }).root.findByType(HOST);

    expect(host.props.sourceClass).toBe(WEBRTC.apple);
    expect(host.props.resizeMode).toBe("cover");
    expect(host.props.mirror).toBe(false);
  });

  it("sends the Android class and no Apple-only props on Android", () => {
    mockPlatform.OS = "android";
    const host = renderHost({
      material: "peer",
      sourceKey: "stream-1",
      sourceClass: WEBRTC,
      resizeMode: "contain",
    }).root.findByType(HOST);

    expect(host.props.sourceClass).toBe(WEBRTC.android);
    expect(host.props).not.toHaveProperty("resizeMode");
    expect(host.props).not.toHaveProperty("mirror");
  });

  it("forwards explicit Apple fitting props", () => {
    const host = renderHost({
      material: "peer",
      sourceKey: "s",
      resizeMode: "contain",
      mirror: true,
    }).root.findByType(HOST);

    expect(host.props.resizeMode).toBe("contain");
    expect(host.props.mirror).toBe(true);
  });

  it("forwards the native ready and error events", () => {
    const onSurfaceReady = jest.fn();
    const onError = jest.fn();
    const host = renderHost({
      material: "peer",
      sourceKey: "s",
      onSurfaceReady,
      onError,
    }).root.findByType(HOST);

    host.props.onCameraReadyViro();
    host.props.onErrorViro({ nativeEvent: { error: "Material 'peer' not found" } });

    expect(onSurfaceReady).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].nativeEvent.error).toBe("Material 'peer' not found");
  });

  it("asks React Native about the native view once across mounts", () => {
    renderHost({ material: "a", sourceKey: "s" });
    renderHost({ material: "b", sourceKey: "s" });
    expect(mockHasViewManagerConfig).toHaveBeenCalledTimes(1);
  });

  it("mounts the view when React Native cannot answer", () => {
    mockHasViewManagerConfig.mockImplementation(() => {
      throw new Error("no UIManager");
    });
    const renderer = renderHost({ material: "a", sourceKey: "s" });
    expect(renderer.root.findAllByType(HOST)).toHaveLength(1);
  });

  it("reports a missing native view once, as a string message, instead of mounting it", () => {
    mockHasViewManagerConfig.mockReturnValue(false);
    const onError = jest.fn();

    const renderer = renderHost({ material: "peer", sourceKey: "s", onError });

    expect(renderer.toJSON()).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].nativeEvent.error).toBe(
      VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR
    );
    expect(() => onError.mock.calls[0][0].persist()).not.toThrow();

    act(() => {
      renderer.update(<ViroExternalVideo material="peer" sourceKey="s2" onError={onError} />);
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("reports a missing native view to an onError attached after mount", () => {
    mockHasViewManagerConfig.mockReturnValue(false);
    const onError = jest.fn();

    const renderer = renderHost({ material: "peer", sourceKey: "s" });
    act(() => {
      renderer.update(<ViroExternalVideo material="peer" sourceKey="s" onError={onError} />);
    });

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
