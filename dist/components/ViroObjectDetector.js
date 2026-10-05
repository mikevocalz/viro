/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from "react";
import { requireNativeComponent, UIManager, } from "react-native";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const NATIVE_VIEW_NAME = "VRTObjectDetectorView";
const VRTObjectDetectorView = requireNativeComponent(NATIVE_VIEW_NAME);
/** The error `onError` reports when the native view is not in this build. */
export const VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR = "VRTObjectDetectorView is not registered with React Native. @reactvision/react-viro up to " +
    "3.0.2 shipped iOS builds without it; update the package, run pod install and rebuild the app.";
let nativeViewRegistered;
/**
 * Whether the native side registered `VRTObjectDetectorView`. `requireNativeComponent` does not
 * check: it hands React a component whose native half may be missing, and the first mount then
 * fails with "View config not found" and takes the screen down. The 3.0.2 iOS archive shipped
 * without the view, so ask once and let the component degrade instead. A React Native that
 * cannot answer is taken at its word and the view is mounted as before.
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
/** Test seam: forgets the answer, so the next mount asks React Native again. */
export function resetObjectDetectorNativeViewCheck() {
    nativeViewRegistered = undefined;
}
/**
 * ViroObjectDetector — on-device open-vocabulary object detection powered by YOLOE.
 *
 * Runs in AR and on Meta Quest:
 * - **Phone AR**: shares the camera feed of the enclosing `ViroARSceneNavigator`
 *   (no separate camera session) and fires `onDetection` with labels, normalized
 *   bounding boxes, and an on-screen `screenBoundingBox` (dp) at up to `maxFPS`.
 * - **Meta Quest 3 / 3S** (Horizon OS v74+): when mounted in a Quest MR scene
 *   (under `ViroXRSceneNavigator`), it captures the headset camera via the Meta
 *   Passthrough Camera API and runs the same YOLOE pipeline. Requires the
 *   `horizonos.permission.HEADSET_CAMERA` runtime permission. v1 emits `label` +
 *   normalized `boundingBox` only — `screenBoundingBox` and `worldPosition` are
 *   not provided on Quest yet (they need camera extrinsics).
 *
 * Mount it as a child or sibling of the scene navigator; it renders nothing itself,
 * so give it `width: 0, height: 0`.
 *
 * @example
 * ```tsx
 * <ViroARSceneNavigator initialScene={{ scene: MyScene }} />
 * <ViroObjectDetector
 *   style={{ position: "absolute", width: 0, height: 0 }}
 *   mode="prompt-free"
 *   confidenceThreshold={0.4}
 *   maxFPS={15}
 *   onDetection={({ detections }) => {
 *     detections.forEach(d => console.log(d.label, d.confidence, d.screenBoundingBox));
 *   }}
 * />
 * ```
 */
export const ViroObjectDetector = ({ model = "yoloe-26s", mode = "prompt-free", categories = [], confidenceThreshold = 0.4, iouThreshold = 0.45, maxFPS = 15, maxDetections = 20, projectToWorld = true, onDetection, onReady, onError, style, ...rest }) => {
    // Its view manager is excluded from the visionOS renderer, so React has no view config for it
    // and mounting fails with "View config not found". visionOS grants no passthrough camera access
    // without an enterprise entitlement, so there is nothing for the detector to look at either.
    const nativeViewAvailable = !isVisionOS && isNativeViewRegistered();
    // Report a missing native view through the component's own error channel, once per mount,
    // with the latest `onError` rather than the one captured on the first render.
    const onErrorRef = React.useRef(onError);
    onErrorRef.current = onError;
    React.useEffect(() => {
        if (isVisionOS || nativeViewAvailable)
            return;
        warnUnsupported("ViroObjectDetector", "this build", VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR);
        onErrorRef.current?.({ error: VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR });
    }, [nativeViewAvailable]);
    const handleDetection = React.useCallback((event) => {
        onDetection?.(event.nativeEvent);
    }, [onDetection]);
    const handleReady = React.useCallback((event) => {
        onReady?.(event.nativeEvent);
    }, [onReady]);
    const handleError = React.useCallback((event) => {
        onError?.(event.nativeEvent);
    }, [onError]);
    if (isVisionOS) {
        warnUnsupported("ViroObjectDetector", "Apple Vision Pro", "visionOS grants no passthrough camera access without an enterprise entitlement.");
        return null;
    }
    if (!nativeViewAvailable) {
        return null;
    }
    return (<VRTObjectDetectorView {...rest} style={style} model={model} mode={mode} categories={categories} confidenceThreshold={confidenceThreshold} iouThreshold={iouThreshold} maxFPS={maxFPS} maxDetections={maxDetections} projectToWorld={projectToWorld} onDetectionViro={onDetection ? handleDetection : undefined} onReadyViro={onReady ? handleReady : undefined} onErrorViro={onError ? handleError : undefined}/>);
};
