package com.viromedia.bridge.module;

/**
 * How the renderer treats the pixels of one {@code canvasSource} texture: whether the producer
 * writes premultiplied alpha, and the rounded corners the renderer's copy applies.
 *
 * <p>Premultiplied alpha follows the material: a {@code blendMode} of {@code PremultiplyAlpha}
 * means the producer writes premultiplied pixels (Canvas, Skia, Rive), so the texture copy must
 * keep them premultiplied. Any other blend mode keeps straight alpha.
 *
 * <p>Corners come from the {@code canvasSource} value: {@code cornerRadius}, {@code panelWidth}
 * and {@code panelHeight}, all in meters on the panel the texture covers. A radius of 0 or no
 * radius leaves every pixel unchanged. A positive radius needs both panel sizes, because the
 * renderer turns meters into pixels per axis.
 */
final class CanvasSourceStyle {
    static final String PREMULTIPLY_ALPHA = "PremultiplyAlpha";

    final boolean premultipliedAlpha;
    final float cornerRadiusM;
    final float panelWidthM;
    final float panelHeightM;

    private CanvasSourceStyle(boolean premultipliedAlpha, float cornerRadiusM,
                              float panelWidthM, float panelHeightM) {
        this.premultipliedAlpha = premultipliedAlpha;
        this.cornerRadiusM = cornerRadiusM;
        this.panelWidthM = panelWidthM;
        this.panelHeightM = panelHeightM;
    }

    /**
     * @param blendMode    the material's {@code blendMode} string, or null when unset
     * @param cornerRadius {@code canvasSource.cornerRadius} in meters, or null when unset
     * @param panelWidth   {@code canvasSource.panelWidth} in meters, or null when unset
     * @param panelHeight  {@code canvasSource.panelHeight} in meters, or null when unset
     * @throws IllegalArgumentException for a negative or non-finite radius, or a positive radius
     *                                  without positive, finite panel sizes
     */
    static CanvasSourceStyle of(String blendMode, Double cornerRadius, Double panelWidth,
                                Double panelHeight) {
        boolean premultiplied = PREMULTIPLY_ALPHA.equalsIgnoreCase(blendMode);
        if (cornerRadius == null || cornerRadius == 0.0) {
            return new CanvasSourceStyle(premultiplied, 0.0f, 0.0f, 0.0f);
        }
        if (!Double.isFinite(cornerRadius) || cornerRadius < 0.0) {
            throw new IllegalArgumentException(
                    "canvasSource cornerRadius must be a finite number of meters >= 0, got "
                            + cornerRadius);
        }
        float width = positiveMeters("panelWidth", panelWidth);
        float height = positiveMeters("panelHeight", panelHeight);
        return new CanvasSourceStyle(premultiplied, cornerRadius.floatValue(), width, height);
    }

    boolean roundsCorners() {
        return cornerRadiusM > 0.0f;
    }

    private static float positiveMeters(String key, Double value) {
        if (value == null || !Double.isFinite(value) || value <= 0.0) {
            throw new IllegalArgumentException("canvasSource cornerRadius needs a positive "
                    + key + " in meters (the panel size the texture covers), got " + value);
        }
        return value.floatValue();
    }
}
