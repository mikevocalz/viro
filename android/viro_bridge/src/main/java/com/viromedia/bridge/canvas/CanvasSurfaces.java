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
 * safe to call from any thread. Listeners never run under this registry's lock, so a listener
 * may call back into the registry. Events are delivered one at a time, in the order they were
 * recorded, by whichever thread is delivering when they are recorded.
 *
 * <p>{@link #provide}, both {@link #revoke} overloads and {@link #addListener} return only
 * after every listener callback for the events they recorded has returned, even when another
 * thread delivers those events. The owner can therefore release a Surface as soon as
 * {@code revoke} returns. One exception: a call made from inside a listener callback runs on
 * the delivering thread, so it cannot wait for itself. It returns at once, and its events are
 * delivered after the current callback returns.
 *
 * <p>A listener should hand the Surface to its own render thread and return quickly, because
 * a caller on another thread may be waiting for it. A listener must not block on a thread
 * that is itself calling into this registry.
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
    // Sequence number of the last event added to sPending, and of the last event whose
    // callbacks have all returned. Events run in order, so sDelivered >= n means event n ran.
    private static long sRecorded;
    private static long sDelivered;
    // The thread running queued events, or null when none is.
    private static Thread sDispatcher;

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
        long ticket;
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
            ticket = sRecorded;
        }
        deliverThrough(ticket);
    }

    /**
     * Withdraws whatever Surface is current for {@code id}. Does nothing if none is.
     *
     * @return true if a Surface was withdrawn
     */
    public static boolean revoke(int id) {
        long ticket;
        synchronized (sLock) {
            Entry previous = sEntries.remove(id);
            if (previous == null) return false;
            enqueueRevoked(previous);
            ticket = sRecorded;
        }
        deliverThrough(ticket);
        return true;
    }

    /**
     * Withdraws {@code surface} only if it is still the current Surface for {@code id}. Use this
     * from an owner that may be disposed after a newer owner already provided the same id.
     *
     * @return true if {@code surface} was current and is now withdrawn
     */
    public static boolean revoke(int id, Surface surface) {
        long ticket;
        synchronized (sLock) {
            Entry current = sEntries.get(id);
            if (current == null || current.surface != surface) return false;
            sEntries.remove(id);
            enqueueRevoked(current);
            ticket = sRecorded;
        }
        deliverThrough(ticket);
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
        long ticket;
        synchronized (sLock) {
            List<Registration> list = sListeners.get(id);
            if (list == null) {
                list = new ArrayList<>();
                sListeners.put(id, list);
            }
            list.add(registration);
            final Entry current = sEntries.get(id);
            if (current != null) {
                record(new Runnable() {
                    @Override
                    public void run() {
                        registration.provided(current);
                    }
                });
            }
            ticket = sRecorded;
        }
        deliverThrough(ticket);
        return registration;
    }

    private static void enqueueProvided(final Entry entry) {
        final List<Registration> targets = snapshot(entry.id);
        if (targets.isEmpty()) return;
        record(new Runnable() {
            @Override
            public void run() {
                for (Registration target : targets) target.provided(entry);
            }
        });
    }

    private static void enqueueRevoked(final Entry entry) {
        final List<Registration> targets = snapshot(entry.id);
        if (targets.isEmpty()) return;
        record(new Runnable() {
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

    // Caller holds sLock.
    private static void record(Runnable event) {
        sPending.add(event);
        sRecorded++;
    }

    /**
     * Returns once every event up to sequence number {@code ticket} has been delivered. If no
     * thread is delivering, the caller delivers the queue itself. If another thread is, the
     * caller waits for it. If the caller is the delivering thread (a listener calling back
     * in), it returns at once: its events are already queued behind the current callback.
     */
    private static void deliverThrough(long ticket) {
        Thread self = Thread.currentThread();
        boolean interrupted = false;
        try {
            while (true) {
                synchronized (sLock) {
                    if (sDelivered >= ticket || sDispatcher == self) return;
                    if (sDispatcher != null) {
                        try {
                            sLock.wait();
                        } catch (InterruptedException error) {
                            // The owner may release the Surface once we return, so keep waiting.
                            interrupted = true;
                        }
                        continue;
                    }
                    sDispatcher = self;
                }
                dispatch();
            }
        } finally {
            if (interrupted) self.interrupt();
        }
    }

    // Runs queued events outside the lock until the queue is empty. Caller is sDispatcher.
    private static void dispatch() {
        try {
            while (true) {
                Runnable next;
                synchronized (sLock) {
                    next = sPending.poll();
                    if (next == null) return;
                }
                try {
                    next.run();
                } finally {
                    synchronized (sLock) {
                        sDelivered++;
                        sLock.notifyAll();
                    }
                }
            }
        } finally {
            // Also reached when an Error escapes a listener: a waiting thread takes over the
            // rest of the queue instead of waiting forever.
            synchronized (sLock) {
                sDispatcher = null;
                sLock.notifyAll();
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
