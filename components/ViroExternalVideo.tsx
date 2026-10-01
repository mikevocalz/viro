/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * @providesModule ViroExternalVideo
 */
import * as React from "react";
import {
  NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
} from "react-native";
import { ViroErrorEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";

export type ViroExternalVideoProvider =
  | string
  | {
      android?: string;
      apple?: string;
    };

export type ViroExternalVideoProps = {
  /** Material whose diffuse texture receives the live external video. */
  material: string;

  /**
   * Producer-defined source identifier. For Fishjam/react-native-webrtc this is
   * MediaStream.toURL().
   */
  sourceKey: string;

  /**
   * Native producer adapter.
   *
   * Android providers expose:
   *   provideSurface(sourceKey, Surface, width, height)
   *   revokeSurface(sourceKey)
   *
   * Apple providers expose class methods:
   *   provideVideoFramesForSourceKey:consumer:width:height:
   *   revokeVideoFramesForSourceKey:consumer:
   *
   * A string applies to the current platform. The object form lets one call
   * site describe both native class names.
   */
  sourceClass?: ViroExternalVideoProvider;

  /** Render-target size owned by Viro. Defaults to 1280x720. */
  pixelSize?: { width: number; height: number };

  /** Apple frame fitting policy. Android producers size directly to the Surface. */
  resizeMode?: "cover" | "contain" | "stretch";

  /** Additional horizontal mirror after producer metadata is applied. */
  mirror?: boolean;

  /** Explicit vertical flip for producer coordinate systems that need it. */
  flipY?: boolean;

  /**
   * Android: producer Surface exists and is connected.
   * Apple/visionOS: the first converted frame has been bound to the material.
   */
  onSurfaceReady?: () => void;

  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

const DEFAULT_ANDROID_PROVIDER =
  "com.oney.WebRTCModule.ExternalVideoSurfaces";
const DEFAULT_APPLE_PROVIDER = "ViroExternalWebRTCFrames";

function resolveProvider(
  sourceClass: ViroExternalVideoProvider | undefined,
): string {
  if (typeof sourceClass === "string") {
    return sourceClass;
  }

  if (Platform.OS === "android") {
    return sourceClass?.android ?? DEFAULT_ANDROID_PROVIDER;
  }

  return sourceClass?.apple ?? DEFAULT_APPLE_PROVIDER;
}

/**
 * Bind externally-produced live video to a Viro material.
 *
 * Android uses a renderer-owned SurfaceTexture/Surface. Apple uses a generic
 * CVPixelBuffer producer and a Metal/Core Image conversion path. This avoids
 * the legacy VROVideoTexture stack, which remains unavailable on visionOS.
 *
 * The component is producer-agnostic: Viro owns the renderer/material side,
 * while packages such as viro-external provide Fishjam/WebRTC, Mux, decoder,
 * camera, or custom GPU producer adapters.
 */
export class ViroExternalVideo extends React.PureComponent<ViroExternalVideoProps> {
  _component: ViroNativeRef = null;

  _onSurfaceReady = () => {
    this.props.onSurfaceReady?.();
  };

  _onError = (event: NativeSyntheticEvent<ViroErrorEvent>) => {
    this.props.onError?.(event);
  };

  render() {
    // Web has its own .web.tsx implementation. On React Native, visionOS is
    // reported as Platform.OS === "ios", so do NOT gate it away here.
    const appleProps =
      Platform.OS === "android"
        ? {}
        : {
            resizeMode: this.props.resizeMode ?? "cover",
            mirror: this.props.mirror ?? false,
            flipY: this.props.flipY ?? false,
          };

    return (
      <VRTExternalVideo
        material={this.props.material}
        sourceKey={this.props.sourceKey}
        sourceClass={resolveProvider(this.props.sourceClass)}
        pixelSize={this.props.pixelSize}
        {...appleProps}
        onCameraReadyViro={this._onSurfaceReady}
        onErrorViro={this._onError}
        ref={(component: ViroNativeRef) => {
          this._component = component;
        }}
      />
    );
  }
}

const VRTExternalVideo = requireNativeComponent<any>(
  "VRTExternalVideo",
  // @ts-ignore legacy requireNativeComponent hostClass argument
  ViroExternalVideo,
  {
    nativeOnly: {
      onCameraReadyViro: true,
      onErrorViro: true,
    },
  },
);
