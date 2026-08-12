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
import { ViroErrorEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
type Props = {
    /**
     * Name of the material (created via ViroMaterials.createMaterials) to bind
     * the externally-produced video to as its diffuse texture. The material only
     * needs a lightingModel (typically "Constant").
     */
    material: string;
    /**
     * Key identifying the producer's video source — for the default WebRTC
     * producer this is the RN-webrtc stream tag (`mediaStream.toURL()`), i.e.
     * "which remote track should render into this material".
     */
    sourceKey: string;
    /**
     * Fully-qualified Java class of the producer registry. Defaults to the
     * patched react-native-webrtc bridge
     * ("com.oney.WebRTCModule.ExternalVideoSurfaces"). Override to feed the
     * texture from a different producer library.
     */
    sourceClass?: string;
    /**
     * Pixel resolution of the texture the producer renders into.
     * Defaults to 1280x720.
     */
    pixelSize?: {
        width: number;
        height: number;
    };
    /**
     * Called once when the GL texture and its producer Surface exist and the
     * Surface has been offered to the producer.
     */
    onSurfaceReady?: () => void;
    /**
     * Called when binding fails (unknown material, producer class missing —
     * i.e. the producer library is not installed/patched — or renderer error).
     */
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
/**
 * ViroExternalVideo binds an app-fed video stream to a named material texture —
 * the live-video analog of ViroCameraTexture for sources that are NOT the
 * device camera: a remote WebRTC track (video conferencing), a MediaCodec
 * decoder, or anything else that can render into an Android Surface.
 *
 * Under the hood it creates a virocore ExternalSurfaceTexture (an OES texture
 * with a raw producer Surface) and offers the Surface to the producer library
 * named by `sourceClass` under `sourceKey`. Android-only.
 *
 * **Usage (Fishjam / react-native-webrtc remote peer):**
 * ```tsx
 * ViroMaterials.createMaterials({ peerScreen: { lightingModel: "Constant" } });
 *
 * <ViroARScene>
 *   <ViroQuad position={[0, 1, -2]} width={1.6} height={0.9} materials={["peerScreen"]} />
 *   {hostStream && (
 *     <ViroExternalVideo
 *       material="peerScreen"
 *       sourceKey={hostStream.toURL()}
 *       pixelSize={{ width: 1280, height: 720 }}
 *     />
 *   )}
 * </ViroARScene>
 * ```
 */
export declare class ViroExternalVideo extends React.Component<Props> {
    _component: ViroNativeRef;
    _onSurfaceReady: () => void;
    _onError: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
    render(): React.JSX.Element | null;
}
export {};
