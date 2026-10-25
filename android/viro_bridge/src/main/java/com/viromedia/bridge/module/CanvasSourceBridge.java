package com.viromedia.bridge.module;

import android.view.Surface;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.viro.core.ExternalSurfaceTexture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.canvas.CanvasSurfaces;
import java.lang.reflect.Method;

/**
 * Owns the renderer texture and publishes its producer Surface through {@link CanvasSurfaces}.
 * Apps that still ship nitro-canvas-in-Vision also get the Surface through its
 * CanvasSourceSurfaces class, found by reflection.
 *
 * <p>Locking: the monitor guards only this object's fields. Registry and Nitro calls run
 * listener callbacks, so they are made after the monitor is released; otherwise a slow
 * listener would block create() and dispose() on other threads, and a listener that touched
 * this bridge from another thread would deadlock against it.
 *
 * <p>Offers arrive from the render thread (ExternalSurfaceTexture's listener) and from create(),
 * which repeats the Surface the render thread already set. Two offers of different Surfaces
 * therefore never run at the same time, so publishes cannot reach the registry out of order.
 */
final class CanvasSourceBridge {
    private static final String PRODUCER =
            "com.margelo.nitro.nitrocanvasinVision.CanvasSourceSurfaces";
    private final int id;
    private final int width;
    private final int height;
    private final CanvasSourceStyle style;
    // Both null when nitro-canvas-in-Vision is not installed.
    private final Method provide;
    private final Method revoke;
    private ExternalSurfaceTexture texture;
    // The Surface most recently accepted by offer(), published or being published.
    private Surface offered;
    // offer() calls between accepting a Surface and finishing its publish.
    private int publishing;
    private boolean disposed;

    static boolean isSource(ReadableMap source) {
        return source != null && source.hasKey("canvasSource");
    }

    /**
     * @param source    the {@code canvasSource} texture value
     * @param blendMode the material's {@code blendMode}, or null when unset. PremultiplyAlpha
     *                  tells the renderer that the producer writes premultiplied alpha.
     */
    CanvasSourceBridge(ReadableMap source, String blendMode) {
        id = positiveInt(source, "canvasSource");
        width = positiveInt(source, "width");
        height = positiveInt(source, "height");
        style = CanvasSourceStyle.of(blendMode, optionalNumber(source, "cornerRadius"),
                optionalNumber(source, "panelWidth"), optionalNumber(source, "panelHeight"));
        Method provideMethod = null;
        Method revokeMethod = null;
        Class<?> producer = null;
        try {
            producer = Class.forName(PRODUCER);
        } catch (ClassNotFoundException absent) {
            // Native producers subscribe to CanvasSurfaces; Nitro is optional.
        }
        if (producer != null) {
            try {
                provideMethod = producer.getMethod("provideSurface", int.class, Surface.class,
                        int.class, int.class);
                revokeMethod = producer.getMethod("revokeSurface", int.class, Surface.class);
            } catch (NoSuchMethodException error) {
                throw new IllegalStateException("nitro-canvas-in-Vision is installed but its "
                        + "CanvasSourceSurfaces lacks provideSurface/revokeSurface", error);
            }
        }
        provide = provideMethod;
        revoke = revokeMethod;
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

    private static Double optionalNumber(ReadableMap source, String key) {
        if (!source.hasKey(key) || source.isNull(key)) return null;
        if (source.getType(key) != ReadableType.Number) {
            throw new IllegalArgumentException("canvasSource " + key + " must be a number");
        }
        return source.getDouble(key);
    }

    ExternalSurfaceTexture create(ViroContext context) {
        ExternalSurfaceTexture created;
        synchronized (this) {
            if (disposed) throw new IllegalStateException("canvasSource is disposed");
            if (texture != null) return texture;
            texture = new ExternalSurfaceTexture(context, width, height, this::offer);
            texture.setPremultipliedAlpha(style.premultipliedAlpha);
            if (style.roundsCorners()) {
                texture.setCornerRadius(style.cornerRadiusM, style.panelWidthM, style.panelHeightM);
            }
            created = texture;
        }
        Surface surface = created.getSurface();
        if (surface != null) offer(surface);
        return created;
    }

    private void offer(Surface surface) {
        synchronized (this) {
            if (disposed || offered == surface) return;
            offered = surface;
            publishing++;
        }
        ExternalSurfaceTexture orphan = null;
        boolean disposedMeanwhile;
        try {
            publish(surface);
        } finally {
            synchronized (this) {
                publishing--;
                disposedMeanwhile = disposed;
                // dispose() leaves the texture to the last publish still running, so the
                // Surface is not released while a listener may still be receiving it.
                if (disposed && publishing == 0) {
                    orphan = texture;
                    texture = null;
                }
            }
        }
        if (disposedMeanwhile) {
            // dispose() may have revoked before this publish reached the registry, so revoke
            // again. Both revokes are conditional on this Surface and the second is a no-op.
            withdraw(surface);
        }
        if (orphan != null) orphan.dispose();
    }

    void dispose() {
        Surface withdrawn;
        ExternalSurfaceTexture released = null;
        synchronized (this) {
            if (disposed) return;
            disposed = true;
            withdrawn = offered;
            offered = null;
            if (publishing == 0) {
                released = texture;
                texture = null;
            }
        }
        try {
            if (withdrawn != null) withdraw(withdrawn);
        } finally {
            // CanvasSurfaces.revoke returns after every listener's onSurfaceRevoked has returned,
            // so the Surface can go now. With a publish still running, that publish releases it.
            if (released != null) released.dispose();
        }
    }

    // Called without the monitor held.
    private void publish(Surface surface) {
        CanvasSurfaces.provide(id, surface, width, height);
        if (provide == null) return;
        try {
            provide.invoke(null, id, surface, width, height);
        } catch (ReflectiveOperationException error) {
            // Fail visibly without unwinding through a native rendering callback.
            android.util.Log.e("CanvasSourceBridge", "Cannot provide canvas Surface", error);
        }
    }

    // Called without the monitor held.
    private void withdraw(Surface surface) {
        CanvasSurfaces.revoke(id, surface);
        if (revoke == null) return;
        try {
            revoke.invoke(null, id, surface);
        } catch (ReflectiveOperationException error) {
            android.util.Log.e("CanvasSourceBridge", "Cannot revoke canvas Surface", error);
        }
    }
}
