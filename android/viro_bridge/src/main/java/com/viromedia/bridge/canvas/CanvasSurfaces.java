package com.viromedia.bridge.canvas;

import android.view.Surface;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Process-wide registry of the producer Surfaces Viro hands out for {@code canvasSource}
 * materials, keyed by the surface id the material was created with.
 *
 * <p>Viro owns each Surface. A native producer (a whiteboard renderer, a Rive renderer) finds
 * the Surface for its id here, draws into it while it is provided, and stops drawing when it
 * is revoked. Producers never release the Surface themselves.
 *
 * <p>Threading: {@link #provide} and {@link #revoke} usually arrive on Viro's GL render thread,
 * and revocation can also arrive on the thread that disposes the material. Every method is
 * safe to call from any thread. Listeners run on whichever thread triggered the event, never
 * under this registry's lock, so a listener may call back into the registry. Events for one
 * registry are delivered one at a time in the order they were recorded, including events a
 * listener causes from inside its own callback.
 *
 * <p>A listener should hand the Surface to its own render thread and return quickly. After
 * {@link Listener#onSurfaceRevoked} returns, the Surface may be released at any time.
 */
public final class CanvasSurfaces {

    /** Receives provide and revoke events for one surface id. */
    public interface Listener {
        /**
         * The Surface for {@code entry.id} is ready to draw into. Called again with a new entry
         * when Viro recreates the Surface, always after the revoke of the previous one.
         */
        void onSurfaceProvided(Entry entry);

        /** {@code entry.surface} must no longer be drawn into. */
        void onSurfaceRevoked(Entry entry);
    }

    /** A provided Surface and the pixel size it was allocated with. Immutable. */
    public static final class Entry {
        public final int id;
        public final Surface surface;
        public final int width;
        public final int height;

        Entry(int id, Surface surface, int width, int height) {
            this.id = id;
            this.surface = surface;
            this.width = width;
            this.height = height;
        }
    }

    /** Stops a listener from receiving further events. Closing twice is a no-op. */
    public interface Subscription extends AutoCloseable {
        @Override
        void close();
    }

    private static final Object sLock = new Object();
    private static final Map<Integer, Entry> sEntries = new HashMap<>();
    private static final Map<Integer, List<Registration>> sListeners = new HashMap<>();
    private static final ArrayDeque<Runnable> sPending = new ArrayDeque<>();
    private static boolean sDispatching;

    private CanvasSurfaces() {}

    /**
     * Publishes {@code surface} for {@code id}. If another Surface is current for the id, its
     * listeners first receive a revoke for it. Providing the current Surface again is a no-op.
     *
     * @throws IllegalArgumentException if {@code surface} is null or a size is not positive
     */
    public static void provide(int id, Surface surface, int width, int height) {
        if (surface == null) throw new IllegalArgumentException("surface must not be null");
        if (width < 1 || height < 1) {
            throw new IllegalArgumentException("surface size must be positive, got "
                    + width + "x" + height);
        }
        synchronized (sLock) {
            Entry previous = sEntries.get(id);
            if (previous != null && previous.surface == surface
                    && previous.width == width && previous.height == height) {
                return;
            }
            Entry next = new Entry(id, surface, width, height);
            sEntries.put(id, next);
            if (previous != null) enqueueRevoked(previous);
            enqueueProvided(next);
        }
        drain();
    }

    /**
     * Withdraws whatever Surface is current for {@code id}. Does nothing if none is.
     *
     * @return true if a Surface was withdrawn
     */
    public static boolean revoke(int id) {
        synchronized (sLock) {
            Entry previous = sEntries.remove(id);
            if (previous == null) return false;
            enqueueRevoked(previous);
        }
        drain();
        return true;
    }

    /**
     * Withdraws {@code surface} only if it is still the current Surface for {@code id}. Use this
     * from an owner that may be disposed after a newer owner already provided the same id.
     *
     * @return true if {@code surface} was current and is now withdrawn
     */
    public static boolean revoke(int id, Surface surface) {
        synchronized (sLock) {
            Entry current = sEntries.get(id);
            if (current == null || current.surface != surface) return false;
            sEntries.remove(id);
            enqueueRevoked(current);
        }
        drain();
        return true;
    }

    /** The current entry for {@code id}, or null if no Surface is provided. */
    public static Entry get(int id) {
        synchronized (sLock) {
            return sEntries.get(id);
        }
    }

    /**
     * Subscribes {@code listener} to {@code id}. If a Surface is already provided, the listener
     * receives it before any later event for the id.
     *
     * @return the handle that ends the subscription
     * @throws IllegalArgumentException if {@code listener} is null
     */
    public static Subscription addListener(int id, Listener listener) {
        if (listener == null) throw new IllegalArgumentException("listener must not be null");
        final Registration registration = new Registration(id, listener);
        synchronized (sLock) {
            List<Registration> list = sListeners.get(id);
            if (list == null) {
                list = new ArrayList<>();
                sListeners.put(id, list);
            }
            list.add(registration);
            final Entry current = sEntries.get(id);
            if (current != null) {
                sPending.add(new Runnable() {
                    @Override
                    public void run() {
                        registration.provided(current);
                    }
                });
            }
        }
        drain();
        return registration;
    }

    private static void enqueueProvided(final Entry entry) {
        final List<Registration> targets = snapshot(entry.id);
        if (targets.isEmpty()) return;
        sPending.add(new Runnable() {
            @Override
            public void run() {
                for (Registration target : targets) target.provided(entry);
            }
        });
    }

    private static void enqueueRevoked(final Entry entry) {
        final List<Registration> targets = snapshot(entry.id);
        if (targets.isEmpty()) return;
        sPending.add(new Runnable() {
            @Override
            public void run() {
                for (Registration target : targets) target.revoked(entry);
            }
        });
    }

    // Caller holds sLock.
    private static List<Registration> snapshot(int id) {
        List<Registration> list = sListeners.get(id);
        return list == null ? new ArrayList<Registration>() : new ArrayList<>(list);
    }

    // Runs queued events outside the lock. Only one thread drains at a time, which keeps
    // delivery in recording order; an event recorded while another thread drains is run by
    // that thread.
    private static void drain() {
        synchronized (sLock) {
            if (sDispatching) return;
            sDispatching = true;
        }
        boolean finished = false;
        try {
            while (true) {
                Runnable next;
                synchronized (sLock) {
                    next = sPending.poll();
                    if (next == null) {
                        sDispatching = false;
                        finished = true;
                        return;
                    }
                }
                next.run();
            }
        } finally {
            if (!finished) {
                synchronized (sLock) {
                    sDispatching = false;
                }
            }
        }
    }

    private static final class Registration implements Subscription {
        private final int id;
        private final Listener listener;
        private volatile boolean closed;

        Registration(int id, Listener listener) {
            this.id = id;
            this.listener = listener;
        }

        // A throwing listener must not starve the others or unwind into the GL thread.
        void provided(Entry entry) {
            if (closed) return;
            try {
                listener.onSurfaceProvided(entry);
            } catch (RuntimeException error) {
                android.util.Log.e("CanvasSurfaces", "onSurfaceProvided threw for id " + id, error);
            }
        }

        void revoked(Entry entry) {
            if (closed) return;
            try {
                listener.onSurfaceRevoked(entry);
            } catch (RuntimeException error) {
                android.util.Log.e("CanvasSurfaces", "onSurfaceRevoked threw for id " + id, error);
            }
        }

        @Override
        public void close() {
            synchronized (sLock) {
                if (closed) return;
                closed = true;
                List<Registration> list = sListeners.get(id);
                if (list == null) return;
                list.remove(this);
                if (list.isEmpty()) sListeners.remove(id);
            }
        }
    }
}
