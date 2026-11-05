package com.viromedia.bridge.module;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

public class CanvasSourceStyleTest {

    @Test
    public void premultipliedOnlyForPremultiplyAlphaBlend() {
        assertTrue(CanvasSourceStyle.of("PremultiplyAlpha", null, null, null).premultipliedAlpha);
        assertTrue(CanvasSourceStyle.of("premultiplyalpha", null, null, null).premultipliedAlpha);
        assertFalse(CanvasSourceStyle.of("Alpha", null, null, null).premultipliedAlpha);
        assertFalse(CanvasSourceStyle.of("None", null, null, null).premultipliedAlpha);
        assertFalse(CanvasSourceStyle.of(null, null, null, null).premultipliedAlpha);
    }

    @Test
    public void noRadiusOrZeroRadiusLeavesCornersSquareWithoutPanelSize() {
        assertFalse(CanvasSourceStyle.of(null, null, null, null).roundsCorners());
        assertFalse(CanvasSourceStyle.of(null, 0.0, null, null).roundsCorners());
    }

    @Test
    public void positiveRadiusCarriesMetersAndPanelSize() {
        CanvasSourceStyle style = CanvasSourceStyle.of("PremultiplyAlpha", 0.038, 1.6, 1.0);
        assertTrue(style.roundsCorners());
        assertTrue(style.premultipliedAlpha);
        assertEquals(0.038f, style.cornerRadiusM, 0.0f);
        assertEquals(1.6f, style.panelWidthM, 0.0f);
        assertEquals(1.0f, style.panelHeightM, 0.0f);
    }

    @Test
    public void rejectsNegativeOrNonFiniteRadius() {
        expectRejected(-0.01, 1.0, 1.0);
        expectRejected(Double.NaN, 1.0, 1.0);
        expectRejected(Double.POSITIVE_INFINITY, 1.0, 1.0);
    }

    @Test
    public void positiveRadiusNeedsBothPanelSizes() {
        expectRejected(0.02, null, 1.0);
        expectRejected(0.02, 1.0, null);
        expectRejected(0.02, 0.0, 1.0);
        expectRejected(0.02, 1.0, -1.0);
        expectRejected(0.02, Double.NaN, 1.0);
    }

    private static void expectRejected(Double radius, Double width, Double height) {
        try {
            CanvasSourceStyle.of("PremultiplyAlpha", radius, width, height);
            fail("expected IllegalArgumentException for radius=" + radius + " width=" + width
                    + " height=" + height);
        } catch (IllegalArgumentException expected) {
            // Message names the bad key; the bridge surfaces it as a material error.
        }
    }
}
