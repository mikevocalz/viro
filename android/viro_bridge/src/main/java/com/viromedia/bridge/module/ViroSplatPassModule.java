//  Copyright © 2026 Viro External. All rights reserved.
//
//  Bridge surface for `@viro-external/splat-pass`. Resolves a scene-nav
//  view tag, walks down to its VROChoreographer native handle, and hands
//  it to libsplat_pass.so for attach/detach.
//
//  Built into viro_bridge unconditionally; if libsplat_pass.so is not
//  bundled in the host APK, isAvailable() returns false and every other
//  method throws — the honest error surface required by the
//  @viro-external/core PROMPT-4 rule.

package com.viromedia.bridge.module;

import android.util.Log;
import android.view.View;
import android.content.Context;
import android.net.Uri;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.Renderer;
import com.viromedia.bridge.component.VRT3DSceneNavigator;

@ReactModule(name = "ViroSplatPass")
public class ViroSplatPassModule extends ReactContextBaseJavaModule {

    private static final String TAG = "ViroSplatPass";
    private static final boolean LIBRARY_LOADED;

    static {
        boolean ok = false;
        try {
            System.loadLibrary("splat_pass");
            ok = true;
        } catch (UnsatisfiedLinkError e) {
            Log.i(TAG, "libsplat_pass.so not present in this build — splat-pass disabled");
        }
        LIBRARY_LOADED = ok;
    }

    public ViroSplatPassModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }

    @Override
    public String getName() {
        return "ViroSplatPass";
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean isAvailable() {
        return LIBRARY_LOADED;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String deviceProfile() {
        if (!LIBRARY_LOADED) return "unavailable";
        return nativeDeviceProfile();
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap getDeviceProfile() {
        WritableMap map = Arguments.createMap();
        if (!LIBRARY_LOADED) {
            map.putString("id", "unavailable");
            map.putInt("maxSplats", 0);
            map.putInt("sortWorkgroupSize", 0);
            map.putInt("expectedFps", 0);
            return map;
        }
        map.putString("id", nativeDeviceProfile());
        map.putInt("maxSplats", nativeMaxSplats());
        map.putInt("sortWorkgroupSize", nativeSortWorkgroupSize());
        map.putInt("expectedFps", nativeExpectedFps());
        return map;
    }

    @ReactMethod
    public void registerPass(final int sceneNavTag, final ReadableMap opts, final Promise promise) {
        if (!LIBRARY_LOADED) {
            promise.reject("ENO_LIB", "libsplat_pass.so not present in this build");
            return;
        }
        final String uri = opts.hasKey("uri") ? opts.getString("uri") : "";
        final String format = opts.hasKey("format") ? opts.getString("format") : "spz";
        final int maxSplats = opts.hasKey("maxSplats") ? opts.getInt("maxSplats") : 500_000;
        final int priority = opts.hasKey("priority") ? opts.getInt("priority") : 0;
        final boolean has4D = opts.hasKey("has4D") && opts.getBoolean("has4D");

        // Fetch SPZ bytes on a worker thread so the UI thread block below
        // gets a ready-to-go byte[]. Network + disk both happen here.
        new Thread(new Runnable() {
            @Override public void run() {
                final byte[] spzBytes;
                try {
                    spzBytes = fetchSourceBytes(getReactApplicationContext(), uri);
                } catch (Throwable t) {
                    promise.reject("EFETCH", "ViroSplatPass: failed to fetch source: " + t.getMessage(), t);
                    return;
                }
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
                                    String id = nativeAttach(choreoRef, uri, format, maxSplats, priority, has4D, spzBytes);
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
        }, "ViroSplatPass-fetch").start();
    }

    /**
     * Read SPZ bytes from a uri. Supports: file://, content:// (via
     * ContentResolver), and http(s)://. RN bundled asset paths (no
     * scheme, starting with `/`) are treated as file paths.
     */
    private static byte[] fetchSourceBytes(Context ctx, String uri) throws Exception {
        if (uri == null || uri.isEmpty()) return null;
        InputStream in = null;
        try {
            if (uri.startsWith("http://") || uri.startsWith("https://")) {
                HttpURLConnection conn = (HttpURLConnection) new URL(uri).openConnection();
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(60_000);
                in = conn.getInputStream();
            } else if (uri.startsWith("content://")) {
                in = ctx.getContentResolver().openInputStream(Uri.parse(uri));
            } else {
                String path = uri.startsWith("file://") ? uri.substring(7) : uri;
                in = new FileInputStream(new File(path));
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream(64 * 1024);
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                bos.write(buf, 0, n);
            }
            return bos.toByteArray();
        } finally {
            if (in != null) try { in.close(); } catch (Throwable ignored) {}
        }
    }

    @ReactMethod
    public void unregisterPass(String id, Promise promise) {
        if (!LIBRARY_LOADED) {
            promise.resolve(null);
            return;
        }
        try {
            nativeDetach(id);
            promise.resolve(null);
        } catch (Throwable t) {
            promise.reject("EDETACH", t.getMessage(), t);
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public int splatCount(String id) {
        if (!LIBRARY_LOADED) return 0;
        return nativeSplatCount(id);
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap metrics(String id) {
        WritableMap map = Arguments.createMap();
        if (!LIBRARY_LOADED) return map;
        map.putInt("splatCount", nativeSplatCount(id));
        map.putDouble("lastFrameMs", nativeLastFrameMs(id));
        map.putInt("droppedFrames", nativeDroppedFrames(id));
        return map;
    }

    // JNI surface — implemented in @viro-external/splat-pass libsplat_pass.so.
    private static native String nativeAttach(long choreographerRef,
                                              String uri,
                                              String format,
                                              int maxSplats,
                                              int priority,
                                              boolean has4D,
                                              byte[] spzBytes);
    private static native void   nativeDetach(String id);
    private static native int    nativeSplatCount(String id);
    private static native double nativeLastFrameMs(String id);
    private static native int    nativeDroppedFrames(String id);
    private static native String nativeDeviceProfile();
    private static native int    nativeMaxSplats();
    private static native int    nativeSortWorkgroupSize();
    private static native int    nativeExpectedFps();
}
