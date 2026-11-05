package com.viromedia.bridge.canvas;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.graphics.SurfaceTexture;
import android.view.Surface;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.Test;

// The registry is process-wide, so every test uses its own surface id.
public class CanvasSurfacesTest {
    private static final AtomicInteger sNextId = new AtomicInteger(1000);

    private static int freshId() {
        return sNextId.incrementAndGet();
    }

    private static Surface newSurface() {
        return new Surface(new SurfaceTexture(0));
    }

    /** Records events as "+<surface index>" for provide and "-<surface index>" for revoke. */
    private static final class Recorder implements CanvasSurfaces.Listener {
        final List<String> events = new ArrayList<>();
        final List<Surface> known;

        Recorder(List<Surface> known) {
            this.known = known;
        }

        @Override
        public void onSurfaceProvided(CanvasSurfaces.Entry entry) {
            events.add("+" + known.indexOf(entry.surface));
        }

        @Override
        public void onSurfaceRevoked(CanvasSurfaces.Entry entry) {
            events.add("-" + known.indexOf(entry.surface));
        }
    }

    @Test
    public void getReturnsImmutableEntryWhileProvided() {
        int id = freshId();
        Surface surface = newSurface();
        assertNull(CanvasSurfaces.get(id));
        CanvasSurfaces.provide(id, surface, 640, 480);
        CanvasSurfaces.Entry entry = CanvasSurfaces.get(id);
        assertEquals(id, entry.id);
        assertSame(surface, entry.surface);
        assertEquals(640, entry.width);
        assertEquals(480, entry.height);
        assertTrue(CanvasSurfaces.revoke(id));
        assertNull(CanvasSurfaces.get(id));
        assertFalse(CanvasSurfaces.revoke(id));
    }

    @Test
    public void lateSubscriberReceivesCurrentSurfaceImmediately() {
        int id = freshId();
        List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        Recorder recorder = new Recorder(surfaces);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, recorder);
        assertEquals(Arrays.asList("+0"), recorder.events);
        subscription.close();
        CanvasSurfaces.revoke(id);
    }

    @Test
    public void replacingSurfaceRevokesOldBeforeProvidingNew() {
        int id = freshId();
        List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        surfaces.add(newSurface());
        Recorder recorder = new Recorder(surfaces);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, recorder);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        CanvasSurfaces.provide(id, surfaces.get(1), 32, 32);
        CanvasSurfaces.revoke(id);
        assertEquals(Arrays.asList("+0", "-0", "+1", "-1"), recorder.events);
        subscription.close();
    }

    // Context recreation in MaterialManager provides the new Surface before it disposes the old
    // bridge. The old bridge's conditional revoke must not withdraw the new Surface.
    @Test
    public void staleConditionalRevokeLeavesNewerSurfaceInPlace() {
        int id = freshId();
        List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        surfaces.add(newSurface());
        Recorder recorder = new Recorder(surfaces);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, recorder);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        CanvasSurfaces.provide(id, surfaces.get(1), 32, 32);
        assertFalse(CanvasSurfaces.revoke(id, surfaces.get(0)));
        assertSame(surfaces.get(1), CanvasSurfaces.get(id).surface);
        assertEquals(Arrays.asList("+0", "-0", "+1"), recorder.events);
        assertTrue(CanvasSurfaces.revoke(id, surfaces.get(1)));
        assertEquals(Arrays.asList("+0", "-0", "+1", "-1"), recorder.events);
        subscription.close();
    }

    @Test
    public void reprovidingTheCurrentSurfaceIsSilent() {
        int id = freshId();
        List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        Recorder recorder = new Recorder(surfaces);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, recorder);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        assertEquals(Arrays.asList("+0"), recorder.events);
        subscription.close();
        CanvasSurfaces.revoke(id);
    }

    @Test
    public void closeIsIdempotentAndStopsDelivery() {
        int id = freshId();
        List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        Recorder kept = new Recorder(surfaces);
        Recorder closed = new Recorder(surfaces);
        CanvasSurfaces.Subscription keptSub = CanvasSurfaces.addListener(id, kept);
        CanvasSurfaces.Subscription closedSub = CanvasSurfaces.addListener(id, closed);
        closedSub.close();
        closedSub.close();
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        assertEquals(Collections.<String>emptyList(), closed.events);
        assertEquals(Arrays.asList("+0"), kept.events);
        keptSub.close();
        CanvasSurfaces.revoke(id);
        assertEquals(Arrays.asList("+0"), kept.events);
    }

    @Test
    public void listenerMayCallBackIntoRegistryAndOrderHolds() {
        final int id = freshId();
        final List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        surfaces.add(newSurface());
        final Recorder observer = new Recorder(surfaces);
        CanvasSurfaces.Subscription reentrant = CanvasSurfaces.addListener(id,
                new CanvasSurfaces.Listener() {
                    @Override
                    public void onSurfaceProvided(CanvasSurfaces.Entry entry) {
                        // Replace the first Surface from inside the callback.
                        if (entry.surface == surfaces.get(0)) {
                            CanvasSurfaces.provide(id, surfaces.get(1), 32, 32);
                        }
                    }

                    @Override
                    public void onSurfaceRevoked(CanvasSurfaces.Entry entry) {}
                });
        CanvasSurfaces.Subscription observing = CanvasSurfaces.addListener(id, observer);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        assertEquals(Arrays.asList("+0", "-0", "+1"), observer.events);
        reentrant.close();
        observing.close();
        CanvasSurfaces.revoke(id);
    }

    @Test
    public void throwingListenerDoesNotStarveOthers() {
        int id = freshId();
        List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        CanvasSurfaces.Subscription thrower = CanvasSurfaces.addListener(id,
                new CanvasSurfaces.Listener() {
                    @Override
                    public void onSurfaceProvided(CanvasSurfaces.Entry entry) {
                        throw new IllegalStateException("boom");
                    }

                    @Override
                    public void onSurfaceRevoked(CanvasSurfaces.Entry entry) {}
                });
        Recorder recorder = new Recorder(surfaces);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, recorder);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        assertEquals(Arrays.asList("+0"), recorder.events);
        CanvasSurfaces.revoke(id);
        assertEquals(Arrays.asList("+0", "-0"), recorder.events);
        thrower.close();
        subscription.close();
    }

    /**
     * Blocks inside onSurfaceProvided until released, and records whether onSurfaceRevoked and
     * the second onSurfaceProvided have finished.
     */
    private static final class SlowListener implements CanvasSurfaces.Listener {
        final Surface slowSurface;
        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        final AtomicBoolean revokeFinished = new AtomicBoolean();
        final AtomicBoolean laterProvideFinished = new AtomicBoolean();

        SlowListener(Surface slowSurface) {
            this.slowSurface = slowSurface;
        }

        @Override
        public void onSurfaceProvided(CanvasSurfaces.Entry entry) {
            if (entry.surface == slowSurface) {
                entered.countDown();
                awaitQuietly(release);
            } else {
                laterProvideFinished.set(true);
            }
        }

        @Override
        public void onSurfaceRevoked(CanvasSurfaces.Entry entry) {
            revokeFinished.set(true);
        }
    }

    private static void awaitQuietly(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("latch timed out");
        } catch (InterruptedException error) {
            throw new AssertionError(error);
        }
    }

    // Waits until `caller` has either returned or parked waiting for the dispatcher.
    private static void awaitReturnedOrParked(Thread caller) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            Thread.State state = caller.getState();
            if (state == Thread.State.TERMINATED || state == Thread.State.WAITING
                    || state == Thread.State.TIMED_WAITING) {
                return;
            }
            Thread.sleep(1);
        }
        throw new AssertionError("caller neither returned nor parked: " + caller.getState());
    }

    // T1 is inside a slow onSurfaceProvided, so it owns delivery. T2's revoke must not return
    // until T1 has delivered T2's revoke: CanvasSourceBridge releases the Surface right after.
    @Test
    public void revokeFromAnotherThreadWaitsForItsRevokeToBeDelivered() throws Exception {
        final int id = freshId();
        final Surface surface = newSurface();
        final SlowListener listener = new SlowListener(surface);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, listener);

        Thread t1 = new Thread(new Runnable() {
            @Override
            public void run() {
                CanvasSurfaces.provide(id, surface, 32, 32);
            }
        }, "t1-provide");
        t1.start();
        awaitQuietly(listener.entered);

        final AtomicReference<Boolean> finishedAtReturn = new AtomicReference<>();
        Thread t2 = new Thread(new Runnable() {
            @Override
            public void run() {
                CanvasSurfaces.revoke(id);
                finishedAtReturn.set(listener.revokeFinished.get());
            }
        }, "t2-revoke");
        t2.start();
        awaitReturnedOrParked(t2);

        listener.release.countDown();
        t2.join(10_000);
        t1.join(10_000);
        assertEquals(Boolean.TRUE, finishedAtReturn.get());
        subscription.close();
    }

    @Test
    public void provideFromAnotherThreadWaitsForItsProvideToBeDelivered() throws Exception {
        final int id = freshId();
        final Surface slow = newSurface();
        final Surface later = newSurface();
        final SlowListener listener = new SlowListener(slow);
        CanvasSurfaces.Subscription subscription = CanvasSurfaces.addListener(id, listener);

        Thread t1 = new Thread(new Runnable() {
            @Override
            public void run() {
                CanvasSurfaces.provide(id, slow, 32, 32);
            }
        }, "t1-provide");
        t1.start();
        awaitQuietly(listener.entered);

        final AtomicReference<Boolean> finishedAtReturn = new AtomicReference<>();
        Thread t2 = new Thread(new Runnable() {
            @Override
            public void run() {
                CanvasSurfaces.provide(id, later, 32, 32);
                finishedAtReturn.set(listener.revokeFinished.get()
                        && listener.laterProvideFinished.get());
            }
        }, "t2-provide");
        t2.start();
        awaitReturnedOrParked(t2);

        listener.release.countDown();
        t2.join(10_000);
        t1.join(10_000);
        assertEquals(Boolean.TRUE, finishedAtReturn.get());
        subscription.close();
        CanvasSurfaces.revoke(id);
    }

    // A listener that revokes from inside its own callback runs on the delivering thread. It
    // must not wait for itself; its revoke is delivered right after the callback returns.
    @Test
    public void reentrantRevokeFromListenerDoesNotDeadlock() {
        final int id = freshId();
        final List<Surface> surfaces = new ArrayList<>();
        surfaces.add(newSurface());
        final AtomicBoolean revokedDuringCallback = new AtomicBoolean(true);
        final Recorder observer = new Recorder(surfaces);
        CanvasSurfaces.Subscription reentrant = CanvasSurfaces.addListener(id,
                new CanvasSurfaces.Listener() {
                    @Override
                    public void onSurfaceProvided(CanvasSurfaces.Entry entry) {
                        assertTrue(CanvasSurfaces.revoke(id));
                        revokedDuringCallback.set(observer.events.contains("-0"));
                    }

                    @Override
                    public void onSurfaceRevoked(CanvasSurfaces.Entry entry) {}
                });
        CanvasSurfaces.Subscription observing = CanvasSurfaces.addListener(id, observer);
        CanvasSurfaces.provide(id, surfaces.get(0), 32, 32);
        assertFalse(revokedDuringCallback.get());
        assertEquals(Arrays.asList("+0", "-0"), observer.events);
        assertNull(CanvasSurfaces.get(id));
        reentrant.close();
        observing.close();
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsNonPositiveSize() {
        CanvasSurfaces.provide(freshId(), newSurface(), 0, 32);
    }
}
