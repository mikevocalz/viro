package com.viromedia.bridge.module;

import android.view.Surface;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.viro.core.ExternalSurfaceTexture;
import com.viro.core.ViroContext;
import java.lang.reflect.Method;

/** Owns the renderer texture; Nitro only borrows its producer Surface. */
final class CanvasSourceBridge {
    private static final String PRODUCER =
            "com.margelo.nitro.nitrocanvasinVision.CanvasSourceSurfaces";
    private final int id;
    private final int width;
    private final int height;
    private final Method provide;
    private final Method revoke;
    private ExternalSurfaceTexture texture;
    private Surface offered;
    private boolean disposed;

    static boolean isSource(ReadableMap source) {
        return source != null && source.hasKey("canvasSource");
    }

    CanvasSourceBridge(ReadableMap source) {
        id = positiveInt(source, "canvasSource");
        width = positiveInt(source, "width");
        height = positiveInt(source, "height");
        try {
            Class<?> producer = Class.forName(PRODUCER);
            provide = producer.getMethod("provideSurface", int.class, Surface.class,
                    int.class, int.class);
            revoke = producer.getMethod("revokeSurface", int.class, Surface.class);
        } catch (ReflectiveOperationException error) {
            throw new IllegalStateException("canvasSource requires a compatible "
                    + "nitro-canvas-in-Vision with CanvasSourceSurfaces", error);
        }
    }

    private static int positiveInt(ReadableMap source, String key) {
        if (!source.hasKey(key) || source.isNull(key)
                || source.getType(key) != ReadableType.Number) {
            throw new IllegalArgumentException("canvasSource requires numeric " + key);
        }
        double value = source.getDouble(key);
        if (!Double.isFinite(value) || value < 1 || value > Integer.MAX_VALUE
                || value != Math.floor(value)) {
            throw new IllegalArgumentException("canvasSource " + key + " must be a positive integer");
        }
        return (int) value;
    }

    synchronized ExternalSurfaceTexture create(ViroContext context) {
        if (disposed) throw new IllegalStateException("canvasSource is disposed");
        if (texture == null) {
            texture = new ExternalSurfaceTexture(context, width, height, this::offer);
            Surface surface = texture.getSurface();
            if (surface != null) offer(surface);
        }
        return texture;
    }

    private synchronized void offer(Surface surface) {
        if (disposed || offered == surface) return;
        try {
            offered = surface;
            provide.invoke(null, id, surface, width, height);
        } catch (ReflectiveOperationException error) {
            // Fail visibly without unwinding through a native rendering callback.
            android.util.Log.e("CanvasSourceBridge", "Cannot provide canvas Surface", error);
        }
    }

    synchronized void dispose() {
        if (disposed) return;
        disposed = true;
        try {
            if (offered != null) revoke.invoke(null, id, offered);
        } catch (ReflectiveOperationException error) {
            android.util.Log.e("CanvasSourceBridge", "Cannot revoke canvas Surface", error);
        } finally {
            offered = null;
            if (texture != null) texture.dispose();
            texture = null;
        }
    }
}
