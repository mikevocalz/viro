//
//  VRTExternalVideoManager.java
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.viromedia.bridge.utility.ViroEvents;

import java.util.Map;

/**
 * React Native ViewManager for {@link VRTExternalVideo}.
 *
 * Registers the component as "VRTExternalVideo" with props material, sourceKey,
 * sourceClass, and pixelSize ({width, height}), plus the two direct events
 * (onCameraReadyViro — reused as "surface ready" — and onErrorViro).
 */
public class VRTExternalVideoManager extends VRTViroViewGroupManager<VRTExternalVideo> {

    public VRTExternalVideoManager(ReactApplicationContext context) {
        super(context);
    }

    @Override
    protected VRTExternalVideo createViewInstance(ThemedReactContext reactContext) {
        return new VRTExternalVideo(reactContext);
    }

    @Override
    public String getName() {
        return "VRTExternalVideo";
    }

    // -----------------------------------------------------------------------
    // Props
    // -----------------------------------------------------------------------

    @ReactProp(name = "material")
    public void setMaterial(VRTExternalVideo view, String material) {
        view.setMaterial(material);
    }

    @ReactProp(name = "sourceKey")
    public void setSourceKey(VRTExternalVideo view, String sourceKey) {
        view.setSourceKey(sourceKey);
    }

    @ReactProp(name = "sourceClass")
    public void setSourceClass(VRTExternalVideo view, String sourceClass) {
        view.setSourceClass(sourceClass);
    }

    @ReactProp(name = "pixelSize")
    public void setPixelSize(VRTExternalVideo view, ReadableMap size) {
        if (size == null) return;
        int w = size.hasKey("width") ? size.getInt("width") : 0;
        int h = size.hasKey("height") ? size.getInt("height") : 0;
        view.setPixelSize(w, h);
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of(
            ViroEvents.ON_CAMERA_READY,
                MapBuilder.of("registrationName", ViroEvents.ON_CAMERA_READY),
            ViroEvents.ON_ERROR,
                MapBuilder.of("registrationName", ViroEvents.ON_ERROR)
        );
    }
}
