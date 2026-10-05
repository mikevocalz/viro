/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from "react";
import { findNodeHandle, NativeModules, requireNativeComponent, } from "react-native";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
const { VRTCameraTextureModule } = NativeModules;
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * ViroCameraTexture binds a live device camera feed to a named material texture.
 *
 * The component creates the camera texture internally and sets it on the material,
 * so the material only needs a lightingModel. The texture is updated every frame.
 *
 * **Usage:**
 * ```tsx
 * import { ViroMaterials, ViroQuad, ViroCameraTexture } from '@reactvision/react-viro';
 *
 * ViroMaterials.createMaterials({
 *   selfieMat: { lightingModel: 'Constant' },
 * });
 *
 * <ViroARScene>
 *   <ViroQuad position={[0, 0, -2]} width={1.6} height={2.4} materials={["selfieMat"]} />
 *   <ViroCameraTexture
 *     material="selfieMat"
 *     cameraPosition="front"
 *     onCameraReady={() => console.log('Camera ready')}
 *     onError={(e) => console.error(e.nativeEvent.error)}
 *   />
 * </ViroARScene>
 * ```
 */
export class ViroCameraTexture extends React.Component {
    _component = null;
    _onCameraReady = () => {
        this.props.onCameraReady && this.props.onCameraReady();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    // ---------------------------------------------------------------------------
    // Capture API
    // ---------------------------------------------------------------------------
    /**
     * Capture a single JPEG still from the camera feed.
     *
     * @param options.outputPath  Absolute path for the output JPEG.
     *                            Omit to let the native layer choose a default
     *                            cache-directory path.
     * @returns  Promise resolving to `{ success: true, url }` on success or
     *           `{ success: false, error }` on failure.
     *
     * @example
     * ```ts
     * const result = await cameraRef.current?.capturePhoto();
     * if (result?.success) console.log('Saved to', result.url);
     * ```
     */
    async capturePhoto(options = {}) {
        const tag = findNodeHandle(this._component);
        if (tag == null) {
            return { success: false, error: "ViroCameraTexture is not mounted" };
        }
        return VRTCameraTextureModule.capturePhoto(tag, options.outputPath ?? null);
    }
    /**
     * Start recording the camera feed to an MP4 file.
     *
     * The promise resolves once the recording session has successfully started.
     * Call {@link stopRecording} to finalise the file.
     *
     * @param options.outputPath  Absolute path for the output MP4.
     *                            Omit to let the native layer choose a default.
     * @returns  Promise resolving to `{ success: true, url }` (the path that
     *           will be written) or `{ success: false, error }`.
     *
     * @example
     * ```ts
     * await cameraRef.current?.startRecording();
     * // … some time later …
     * const result = await cameraRef.current?.stopRecording();
     * if (result?.success) console.log('Video saved to', result.url);
     * ```
     */
    async startRecording(options = {}) {
        const tag = findNodeHandle(this._component);
        if (tag == null) {
            return { success: false, error: "ViroCameraTexture is not mounted" };
        }
        return VRTCameraTextureModule.startRecording(tag, options.outputPath ?? null);
    }
    /**
     * Stop an in-progress recording and finalise the MP4 file.
     *
     * @returns  Promise resolving to `{ success: true, url }` with the path of
     *           the written file, or `{ success: false, error }`.
     */
    async stopRecording() {
        const tag = findNodeHandle(this._component);
        if (tag == null) {
            return { success: false, error: "ViroCameraTexture is not mounted" };
        }
        return VRTCameraTextureModule.stopRecording(tag);
    }
    render() {
        // ViroCameraTexture's view manager is excluded from the visionOS renderer, so React has no view
        // config for it and mounting fails with "View config not found".
        if (isVisionOS) {
            warnUnsupported("ViroCameraTexture", "Apple Vision Pro", "visionOS grants no passthrough camera access without an enterprise entitlement.");
            return null;
        }
        const nativeProps = Object.assign({}, this.props);
        nativeProps.cameraPosition = this.props.cameraPosition ?? "front";
        nativeProps.paused = this.props.paused ?? false;
        nativeProps.onCameraReadyViro = this._onCameraReady;
        nativeProps.onErrorViro = this._onError;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTCameraTexture {...nativeProps}/>;
    }
}
// ---------------------------------------------------------------------------
// Native component binding
// ---------------------------------------------------------------------------
const VRTCameraTexture = requireNativeComponent("VRTCameraTexture", 
// @ts-ignore
ViroCameraTexture, {
    nativeOnly: {
        onCameraReadyViro: true,
        onErrorViro: true,
    },
});
