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
import { NativeSyntheticEvent } from "react-native";
import type { ViroExternalVideoSourceClass } from "./Types/ViroExternalVideoSourceClass";
import { ViroNativeRef } from "./Types/ViroUtils";
import { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR } from "./Utilities/externalVideoUnavailableError";
export { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR };
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
    pixelSize?: {
        width: number;
        height: number;
    };
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
    onError?: (event: NativeSyntheticEvent<{
        error: string;
    }>) => void;
};
/** Test seam: forgets the registration answer so the next mount asks again. */
export declare function resetExternalVideoNativeViewCheck(): void;
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
export declare class ViroExternalVideo extends React.Component<ViroExternalVideoProps> {
    _component: ViroNativeRef;
    _warnedUnavailable: boolean;
    _reportedUnavailable: boolean;
    componentDidMount(): void;
    componentDidUpdate(): void;
    /** Warns once per instance, and reports once to `onError`, even if it is attached later. */
    _reportIfUnavailable(): void;
    _setComponent: (component: ViroNativeRef) => void;
    _onSurfaceReady: () => void;
    _onError: (event: NativeSyntheticEvent<{
        error: string;
    }>) => void;
    render(): React.JSX.Element | null;
}
