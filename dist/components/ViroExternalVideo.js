"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroExternalVideo = void 0;
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
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
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
class ViroExternalVideo extends React.Component {
    _component = null;
    _onSurfaceReady = () => {
        this.props.onSurfaceReady && this.props.onSurfaceReady();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    render() {
        if (react_native_1.Platform.OS !== "android") {
            // iOS producers would need a CVPixelBuffer path — not implemented.
            return null;
        }
        return (<VRTExternalVideo material={this.props.material} sourceKey={this.props.sourceKey} sourceClass={this.props.sourceClass} pixelSize={this.props.pixelSize} onCameraReadyViro={this._onSurfaceReady} onErrorViro={this._onError} ref={(component) => {
                this._component = component;
            }}/>);
    }
}
exports.ViroExternalVideo = ViroExternalVideo;
// ---------------------------------------------------------------------------
// Native component binding
// ---------------------------------------------------------------------------
const VRTExternalVideo = (0, react_native_1.requireNativeComponent)("VRTExternalVideo", 
// @ts-ignore
ViroExternalVideo, {
    nativeOnly: {
        onCameraReadyViro: true,
        onErrorViro: true,
    },
});
