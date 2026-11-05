/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroExternalVideo
 */
import * as React from "react";
import {
  NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
  UIManager,
} from "react-native";
import type { ViroExternalVideoSourceClass } from "./Types/ViroExternalVideoSourceClass";
import { ViroNativeRef } from "./Types/ViroUtils";
import { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR } from "./Utilities/externalVideoUnavailableError";
import { resolveExternalVideoSourceClass } from "./Utilities/resolveExternalVideoSourceClass";

export { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR };

const NATIVE_VIEW_NAME = "VRTExternalVideo";

/**
 * Props for {@linkcode ViroExternalVideo}.
 */
export type ViroExternalVideoProps = {
  /**
   * Name of the material (created via ViroMaterials.createMaterials) whose diffuse texture
   * receives the video. The material only needs a lightingModel, typically "Constant".
   */
  material: string;

  /**
   * Producer-defined key for the video source. For react-native-webrtc and Fishjam this is
   * `MediaStream.toURL()`.
   */
  sourceKey: string;

  /**
   * Native producer class, as a Java class name (Android) or a per-platform object.
   * Defaults to the react-native-webrtc producer on each platform.
   */
  sourceClass?: ViroExternalVideoSourceClass;

  /**
   * Pixel size of the texture the video is drawn into. Changing it re-offers the texture to the
   * producer, so pass a stable object.
   * @default { width: 1280, height: 720 }
   */
  pixelSize?: { width: number; height: number };

  /**
   * How a frame whose aspect ratio differs from `pixelSize` is fitted. Android producers draw
   * straight into the texture's Surface and size themselves, so this applies to iOS and
   * visionOS only.
   * @default "cover"
   * @platform ios, visionos
   */
  resizeMode?: "cover" | "contain" | "stretch";

  /**
   * Mirrors the video horizontally, on top of any mirroring the producer reports per frame.
   * @default false
   * @platform ios, visionos
   */
  mirror?: boolean;

  /**
   * Fires once the video is bound. Android: the producer Surface exists and was offered to the
   * producer. iOS/visionOS: the first frame reached the material.
   */
  onSurfaceReady?: () => void;

  /**
   * Fires when binding fails: unknown material, producer class not installed, or a native build
   * without this view ({@linkcode VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR}). `error` is the
   * message.
   */
  onError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
};

let nativeViewRegistered: boolean | undefined;

/**
 * `requireNativeComponent` does not check that the view exists natively, and mounting a missing
 * one takes the screen down with "View config not found". Native builds made before the Apple
 * backend have no iOS view, so ask React Native once. A React Native that cannot answer is taken
 * at its word.
 */
function isNativeViewRegistered(): boolean {
  if (nativeViewRegistered === undefined) {
    try {
      nativeViewRegistered =
        typeof UIManager.hasViewManagerConfig === "function"
          ? UIManager.hasViewManagerConfig(NATIVE_VIEW_NAME)
          : true;
    } catch {
      nativeViewRegistered = true;
    }
  }
  return nativeViewRegistered;
}

/** Test seam: forgets the registration answer so the next mount asks again. */
export function resetExternalVideoNativeViewCheck(): void {
  nativeViewRegistered = undefined;
}

type HostTarget = NativeSyntheticEvent<{ error: string }>["target"];

/**
 * An `onError` event raised from JS, shaped like the ones the native view sends. The view was
 * never mounted, so there is no host element: `target` and `currentTarget` are null.
 */
function createErrorEvent(message: string): NativeSyntheticEvent<{ error: string }> {
  const noHost = null as unknown as NonNullable<HostTarget>;
  return {
    nativeEvent: { error: message },
    currentTarget: noHost,
    target: noHost,
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    timeStamp: Date.now(),
    type: "error",
    preventDefault: () => undefined,
    isDefaultPrevented: () => false,
    stopPropagation: () => undefined,
    isPropagationStopped: () => false,
    persist: () => undefined,
    dispatchConfig: { registrationName: "onError" },
  };
}

/**
 * ViroExternalVideo binds app-fed live video to a named material texture: the live-video analog
 * of ViroCameraTexture for sources that are not the device camera, such as a remote WebRTC
 * track, a decoder, or any producer adapter.
 *
 * - Android: creates an external OES texture and offers its Surface to the producer named by
 *   `sourceClass` under `sourceKey`.
 * - iOS and visionOS: the producer pushes CVPixelBuffer frames. Viro converts each to BGRA on
 *   the GPU, fits it to `pixelSize`, and swaps it into the material through the renderer's video
 *   texture cache, so the OpenGL (iPhone) and Metal (visionOS) renderers share one path.
 *
 * @example
 * ```tsx
 * ViroMaterials.createMaterials({ peerScreen: { lightingModel: "Constant" } });
 *
 * <ViroQuad position={[0, 1, -2]} width={1.6} height={0.9} materials={["peerScreen"]} />
 * <ViroExternalVideo
 *   material="peerScreen"
 *   sourceKey={stream.toURL()}
 *   sourceClass={{
 *     android: "com.oney.WebRTCModule.ViroExternalWebRTCFrames",
 *     apple: "ViroExternalWebRTCFrames",
 *   }}
 * />
 * ```
 */
export class ViroExternalVideo extends React.Component<ViroExternalVideoProps> {
  _component: ViroNativeRef = null;
  _warnedUnavailable = false;
  _reportedUnavailable = false;

  componentDidMount() {
    this._reportIfUnavailable();
  }

  componentDidUpdate() {
    this._reportIfUnavailable();
  }

  /** Warns once per instance, and reports once to `onError`, even if it is attached later. */
  _reportIfUnavailable() {
    if (isNativeViewRegistered()) {
      return;
    }
    if (!this._warnedUnavailable) {
      this._warnedUnavailable = true;
      console.warn(`[Viro] ${VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR}`);
    }
    if (!this._reportedUnavailable && this.props.onError) {
      this._reportedUnavailable = true;
      this.props.onError(createErrorEvent(VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR));
    }
  }

  _setComponent = (component: ViroNativeRef) => {
    this._component = component;
  };

  _onSurfaceReady = () => {
    this.props.onSurfaceReady?.();
  };

  _onError = (event: NativeSyntheticEvent<{ error: string }>) => {
    this.props.onError?.(event);
  };

  render() {
    if (!isNativeViewRegistered()) {
      return null;
    }

    const appleProps =
      Platform.OS === "android"
        ? {}
        : {
            resizeMode: this.props.resizeMode ?? "cover",
            mirror: this.props.mirror ?? false,
          };

    return (
      <VRTExternalVideo
        material={this.props.material}
        sourceKey={this.props.sourceKey}
        sourceClass={resolveExternalVideoSourceClass(
          this.props.sourceClass,
          Platform.OS
        )}
        pixelSize={this.props.pixelSize}
        {...appleProps}
        onCameraReadyViro={this._onSurfaceReady}
        onErrorViro={this._onError}
        ref={this._setComponent}
      />
    );
  }
}

// ---------------------------------------------------------------------------
// Native component binding
// ---------------------------------------------------------------------------

const VRTExternalVideo = requireNativeComponent<any>(
  NATIVE_VIEW_NAME,
  // @ts-ignore legacy requireNativeComponent hostClass argument
  ViroExternalVideo,
  {
    nativeOnly: {
      onCameraReadyViro: true,
      onErrorViro: true,
    },
  }
);
