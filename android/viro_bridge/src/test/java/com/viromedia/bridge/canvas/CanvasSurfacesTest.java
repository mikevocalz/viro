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
import java.util.concurrent.atomic.AtomicInteger;

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

    @Test(expected = IllegalArgumentException.class)
    public void rejectsNonPositiveSize() {
        CanvasSurfaces.provide(freshId(), newSurface(), 0, 32);
    }
}
