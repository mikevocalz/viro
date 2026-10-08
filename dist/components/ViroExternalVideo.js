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
import { Platform, requireNativeComponent, UIManager, } from "react-native";
import { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR } from "./Utilities/externalVideoUnavailableError";
import { resolveExternalVideoSourceClass } from "./Utilities/resolveExternalVideoSourceClass";
export { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR };
const NATIVE_VIEW_NAME = "VRTExternalVideo";
let nativeViewRegistered;
/**
 * `requireNativeComponent` does not check that the view exists natively, and mounting a missing
 * one takes the screen down with "View config not found". Native builds made before the Apple
 * backend have no iOS view, so ask React Native once. A React Native that cannot answer is taken
 * at its word.
 */
function isNativeViewRegistered() {
    if (nativeViewRegistered === undefined) {
        try {
            nativeViewRegistered =
                typeof UIManager.hasViewManagerConfig === "function"
                    ? UIManager.hasViewManagerConfig(NATIVE_VIEW_NAME)
                    : true;
        }
        catch {
            nativeViewRegistered = true;
        }
    }
    return nativeViewRegistered;
}
/** Test seam: forgets the registration answer so the next mount asks again. */
export function resetExternalVideoNativeViewCheck() {
    nativeViewRegistered = undefined;
}
/**
 * An `onError` event raised from JS, shaped like the ones the native view sends. The view was
 * never mounted, so there is no host element: `target` and `currentTarget` are null.
 */
function createErrorEvent(message) {
    const noHost = null;
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
export class ViroExternalVideo extends React.Component {
    _component = null;
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
    _setComponent = (component) => {
        this._component = component;
    };
    _onSurfaceReady = () => {
        this.props.onSurfaceReady?.();
    };
    _onError = (event) => {
        this.props.onError?.(event);
    };
    render() {
        if (!isNativeViewRegistered()) {
            return null;
        }
        const appleProps = Platform.OS === "android"
            ? {}
            : {
                resizeMode: this.props.resizeMode ?? "cover",
                mirror: this.props.mirror ?? false,
            };
        return (<VRTExternalVideo material={this.props.material} sourceKey={this.props.sourceKey} sourceClass={resolveExternalVideoSourceClass(this.props.sourceClass, Platform.OS)} pixelSize={this.props.pixelSize} {...appleProps} onCameraReadyViro={this._onSurfaceReady} onErrorViro={this._onError} ref={this._setComponent}/>);
    }
}
// ---------------------------------------------------------------------------
// Native component binding
// ---------------------------------------------------------------------------
const VRTExternalVideo = requireNativeComponent(NATIVE_VIEW_NAME, 
// @ts-ignore legacy requireNativeComponent hostClass argument
ViroExternalVideo, {
    nativeOnly: {
        onCameraReadyViro: true,
        onErrorViro: true,
    },
});
