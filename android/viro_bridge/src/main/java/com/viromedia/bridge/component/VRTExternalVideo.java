//
//  VRTExternalVideo.java
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

import android.util.Log;
import android.view.Surface;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.ExternalSurfaceTexture;
import com.viro.core.Material;
import com.viro.core.ViroContext;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viromedia.bridge.utility.ViroEvents;

import java.lang.reflect.Method;

/**
 * VRTExternalVideo binds an app-fed video producer to a Viro material.
 *
 * It creates an {@link ExternalSurfaceTexture} (from virocore) — an OES texture
 * whose producer-facing {@link Surface} is exposed raw — sets it as the diffuse
 * texture of the named material (exactly like {@link VRTCameraTexture}), and then
 * OFFERS the Surface to the producer named by {@code sourceKey}.
 *
 * The offer is decoupled by reflection so react_viro has no compile-time
 * dependency on any producer package. A producer library (e.g. a patched
 * react-native-webrtc that renders a remote WebRTC VideoTrack) opts in by
 * shipping a class {@code <sourceClass>} with two static methods:
 *
 *   public static void provideSurface(String sourceKey, Surface s, int w, int h)
 *   public static void revokeSurface(String sourceKey)
 *
 * `sourceClass` defaults to the patched webrtc bridge
 * ("com.oney.WebRTCModule.ExternalVideoSurfaces"). When the class is absent the
 * component emits onErrorViro instead of crashing, so an unpatched build fails
 * loudly but safely.
 *
 * Construction is deferred until {@link #setViroContext(ViroContext)}, the same
 * pattern as VRTCameraTexture / VRT360Video.
 */
public class VRTExternalVideo extends VRTComponent {

    private static final String TAG = "VRTExternalVideo";
    private static final String DEFAULT_SOURCE_CLASS =
            "com.oney.WebRTCModule.ExternalVideoSurfaces";

    private ExternalSurfaceTexture mTexture = null;
    private String mMaterialName = null;
    private String mSourceKey = null;
    private String mSourceClass = DEFAULT_SOURCE_CLASS;
    private int mPxWidth = 1280;
    private int mPxHeight = 720;

    // The key currently provided to the producer, so prop changes revoke cleanly.
    private String mProvidedKey = null;

    public VRTExternalVideo(ReactContext reactContext) {
        super(reactContext.getBaseContext(), null, -1, -1, reactContext);
    }

    // -----------------------------------------------------------------------
    // ViroContext lifecycle — deferred texture construction
    // -----------------------------------------------------------------------

    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        createTexture();
    }

    // -----------------------------------------------------------------------
    // React Native prop setters
    // -----------------------------------------------------------------------

    public void setMaterial(String materialName) {
        mMaterialName = materialName;
        bindToMaterial();
    }

    public void setSourceKey(String sourceKey) {
        if (sourceKey == null || sourceKey.equals(mSourceKey)) return;
        revokeFromProducer();
        mSourceKey = sourceKey;
        offerToProducer();
    }

    public void setSourceClass(String sourceClass) {
        mSourceClass = (sourceClass != null) ? sourceClass : DEFAULT_SOURCE_CLASS;
    }

    /** Producer pixel size. Recreates the texture if it already exists. */
    public void setPixelSize(int width, int height) {
        if (width <= 0 || height <= 0 || (width == mPxWidth && height == mPxHeight)) return;
        mPxWidth = width;
        mPxHeight = height;
        if (mTexture != null && mViroContext != null) {
            revokeFromProducer();
            mTexture.dispose();
            mTexture = null;
            createTexture();
            bindToMaterial();
        }
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private void createTexture() {
        if (mViroContext == null || mTexture != null) return;

        mTexture = new ExternalSurfaceTexture(mViroContext, mPxWidth, mPxHeight,
                new ExternalSurfaceTexture.SurfaceListener() {
                    @Override
                    public void onSurfaceReady(Surface surface) {
                        // Rendering thread — hop nothing: the producer offer is a
                        // static-map put, and the ready event goes through RN's
                        // own thread-safe emitter.
                        offerToProducer();
                        ViroEventEmitter.emit(mReactContext, getId(),
                                ViroEvents.ON_CAMERA_READY, null);
                    }
                });

        bindToMaterial();
        offerToProducer(); // covers the listener-already-fired race via getSurface()
    }

    private void bindToMaterial() {
        if (mMaterialName == null || mTexture == null) return;

        MaterialManager materialManager =
                ((ReactContext) getContext()).getNativeModule(MaterialManager.class);
        if (materialManager == null) return;

        Material material = materialManager.getMaterial(mMaterialName);
        if (material != null) {
            material.setDiffuseTexture(mTexture);
        } else {
            emitError("Material '" + mMaterialName + "' not found");
        }
    }

    private void offerToProducer() {
        if (mSourceKey == null || mTexture == null) return;
        Surface surface = mTexture.getSurface();
        if (surface == null) return; // listener will re-offer once ready

        try {
            Class<?> cls = Class.forName(mSourceClass);
            Method provide = cls.getMethod("provideSurface",
                    String.class, Surface.class, int.class, int.class);
            provide.invoke(null, mSourceKey, surface, mPxWidth, mPxHeight);
            mProvidedKey = mSourceKey;
        } catch (ClassNotFoundException e) {
            emitError("Producer class not found: " + mSourceClass
                    + " (is the producer library installed/patched?)");
        } catch (Exception e) {
            Log.e(TAG, "provideSurface failed", e);
            emitError("provideSurface failed: " + e.getMessage());
        }
    }

    private void revokeFromProducer() {
        if (mProvidedKey == null) return;
        try {
            Class<?> cls = Class.forName(mSourceClass);
            Method revoke = cls.getMethod("revokeSurface", String.class);
            revoke.invoke(null, mProvidedKey);
        } catch (Exception e) {
            Log.w(TAG, "revokeSurface failed (producer gone?)", e);
        }
        mProvidedKey = null;
    }

    private void emitError(String message) {
        WritableMap event = Arguments.createMap();
        event.putString("error", message);
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_ERROR, event);
    }

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    @Override
    public void onTearDown() {
        revokeFromProducer();
        if (mTexture != null) {
            mTexture.dispose();
            mTexture = null;
        }
        super.onTearDown();
    }
}
