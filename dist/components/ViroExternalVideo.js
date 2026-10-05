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
import { Platform, requireNativeComponent, } from "react-native";
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
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
export class ViroExternalVideo extends React.Component {
    _component = null;
    _onSurfaceReady = () => {
        this.props.onSurfaceReady && this.props.onSurfaceReady();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    render() {
        if (Platform.OS !== "android") {
            // iOS producers would need a CVPixelBuffer path — not implemented.
            return null;
        }
        return (<VRTExternalVideo material={this.props.material} sourceKey={this.props.sourceKey} sourceClass={this.props.sourceClass} pixelSize={this.props.pixelSize} onCameraReadyViro={this._onSurfaceReady} onErrorViro={this._onError} ref={(component) => {
                this._component = component;
            }}/>);
    }
}
// ---------------------------------------------------------------------------
// Native component binding
// ---------------------------------------------------------------------------
const VRTExternalVideo = requireNativeComponent("VRTExternalVideo", 
// @ts-ignore
ViroExternalVideo, {
    nativeOnly: {
        onCameraReadyViro: true,
        onErrorViro: true,
    },
});
