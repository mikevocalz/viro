/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from "react";
import { requireNativeComponent, } from "react-native";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const VRTObjectDetectorView = requireNativeComponent("VRTObjectDetectorView");
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
  // Its view manager is excluded from the visionOS renderer, so React has no view config for it
  // and mounting fails with "View config not found". visionOS grants no passthrough camera access
  // without an enterprise entitlement, so there is nothing for the detector to look at either.
  if (isVisionOS) {
    warnUnsupported(
      "ViroObjectDetector",
      "Apple Vision Pro",
      "visionOS grants no passthrough camera access without an enterprise entitlement."
    );
    return null;
  }

 *     detections.forEach(d => console.log(d.label, d.confidence, d.screenBoundingBox));
 *   }}
 * />
 * ```
 */
export const ViroObjectDetector = ({ model = "yoloe-26s", mode = "prompt-free", categories = [], confidenceThreshold = 0.4, iouThreshold = 0.45, maxFPS = 15, maxDetections = 20, projectToWorld = true, onDetection, onReady, onError, style, ...rest }) => {
    // Its view manager is excluded from the visionOS renderer, so React has no view config for it
    // and mounting fails with "View config not found". visionOS grants no passthrough camera access
    // without an enterprise entitlement, so there is nothing for the detector to look at either.
    // Safe above the hooks: isVisionOS is a module constant, so the hook order never varies.
    if (isVisionOS) {
        warnUnsupported("ViroObjectDetector", "Apple Vision Pro", "visionOS grants no passthrough camera access without an enterprise entitlement.");
        return null;
    }
    const handleDetection = React.useCallback((event) => {
        onDetection?.(event.nativeEvent);
    }, [onDetection]);
    const handleReady = React.useCallback((event) => {
        onReady?.(event.nativeEvent);
    }, [onReady]);
    const handleError = React.useCallback((event) => {
        onError?.(event.nativeEvent);
    }, [onError]);
    return (<VRTObjectDetectorView {...rest} style={style} model={model} mode={mode} categories={categories} confidenceThreshold={confidenceThreshold} iouThreshold={iouThreshold} maxFPS={maxFPS} maxDetections={maxDetections} projectToWorld={projectToWorld} onDetectionViro={onDetection ? handleDetection : undefined} onReadyViro={onReady ? handleReady : undefined} onErrorViro={onError ? handleError : undefined}/>);
};
