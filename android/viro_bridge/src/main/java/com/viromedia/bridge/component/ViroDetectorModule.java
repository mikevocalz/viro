// Copyright © 2026 ReactVision. All rights reserved.
// MIT License — see LICENSE file.

package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * JS pull-access to the latest ViroObjectDetector results.
 *
 * ViroObjectDetector runs inference on a background thread and emits per-frame
 * detections, but native→JS PUSH (custom view direct-event AND ReactContext
 * device-event) does not cross reliably to JS under New-Architecture bridgeless —
 * verified on-device: the native dispatch is correct, yet neither the onDetection
 * prop nor a DeviceEventEmitter listener ever fires. JS→native CALLS are unaffected,
 * so the detector caches its latest results and JS polls them through this module.
 *
 * getLatestDetections() is a blocking-synchronous method returning a JSON string
 * ([{label,confidence,boundingBox:{x,y,width,height}}], boundingBox normalized
 * [0,1]) — cheap enough to poll at the detector's frame rate.
 */
public class ViroDetectorModule extends ReactContextBaseJavaModule {

    public ViroDetectorModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ViroDetectorModule";
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getLatestDetections() {
        return VRTObjectDetectorView.latestDetectionsJson();
    }

    /** Base64 JPEG of the top detection, cropped from the camera frame — the input
     *  the JS CLIP identifier embeds. Empty string until a detection is cropped. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getLatestCardCrop() {
        return VRTObjectDetectorView.latestCardCropB64();
    }
}
