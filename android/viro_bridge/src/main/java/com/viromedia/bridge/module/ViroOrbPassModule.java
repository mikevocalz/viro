// ViroOrbPassModule.java
// @viro-external/orb-pass — Java bridge
//
// Mirrors ViroSplatPassModule's sceneNavTag → Renderer → choreographerRef
// walk. Attaches a native VROOrbRenderPass to the choreographer's multiplex
// (via ViroExternalPassRegistry, C++ side).
//
// No source fetch, no bytes to pass — orb geometry is hardcoded in the
// native pass for MVP. Real orb-pass will accept GLSL + geometry blobs.

package com.viromedia.bridge.module;

import android.view.View;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;

import com.viro.core.Renderer;
import com.viromedia.bridge.component.VRT3DSceneNavigator;

public class ViroOrbPassModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("viro_orb_pass");
    }

    public ViroOrbPassModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ViroOrbPass";
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        promise.resolve(true);
    }

    @ReactMethod
    public void registerPass(final int sceneNavTag, final int priority, final Promise promise) {
        getReactApplicationContext().runOnUiQueueThread(new Runnable() {
            @Override public void run() {
                UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
                if (uiManager == null) {
                    promise.reject("ENO_UI", "UIManager not available");
                    return;
                }
                ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
                    @Override
                    public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                        View view = viewResolver.resolveView(sceneNavTag);
                        if (!(view instanceof VRT3DSceneNavigator)) {
                            promise.reject("ENO_VIEW", "view is not a VRT3DSceneNavigator");
                            return;
                        }
                        VRT3DSceneNavigator nav = (VRT3DSceneNavigator) view;
                        Renderer renderer = nav.getViroView() != null ? nav.getViroView().getRenderer() : null;
                        if (renderer == null) {
                            promise.reject("ENO_RENDERER", "scene navigator has no active renderer");
                            return;
                        }
                        long choreoRef = renderer.getChoreographerRef();
                        if (choreoRef == 0) {
                            promise.reject("ENO_CHOREO", "renderer has no choreographer");
                            return;
                        }
                        try {
                            String id = nativeAttach(choreoRef, priority);
                            promise.resolve(id);
                        } catch (Throwable t) {
                            renderer.releaseChoreographerRef(choreoRef);
                            promise.reject("EATTACH", t.getMessage(), t);
                        }
                    }
                });
            }
        });
    }

    @ReactMethod
    public void unregisterPass(final String id, final Promise promise) {
        boolean ok = nativeDetach(id);
        promise.resolve(ok);
    }

    @ReactMethod
    public void setTalk(final String id, final float value) {
        nativeSetTalk(id, value);
    }

    @ReactMethod
    public void setIgnition(final String id, final float value) {
        nativeSetIgnition(id, value);
    }

    @ReactMethod
    public void setBreath(final String id, final float value) {
        nativeSetBreath(id, value);
    }

    @ReactMethod
    public void setListen(final String id, final float value) {
        nativeSetListen(id, value);
    }

    @ReactMethod
    public void setPosition(final String id, final float x, final float y, final float z) {
        nativeSetPosition(id, x, y, z);
    }

    private static native String nativeAttach(long choreographerRef, int priority);
    private static native boolean nativeDetach(String id);
    private static native void nativeSetTalk(String id, float value);
    private static native void nativeSetIgnition(String id, float value);
    private static native void nativeSetBreath(String id, float value);
    private static native void nativeSetListen(String id, float value);
    private static native void nativeSetPosition(String id, float x, float y, float z);
}
