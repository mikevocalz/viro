import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { LINE_ADVANCE_EMS } from "./lensSemantics";
import type { MeasureTextCm, TextFont, TextLayout } from "./textLayout";

/** Turns a {@linkcode TextLayout} into pixels. Tests use {@linkcode createFixedAdvanceRasterizer}. */
export interface TextRasterizer {
  readonly measure: MeasureTextCm;
  /** Draws `layout` white-on-transparent into a texture, or null when no canvas exists. */
  draw(layout: TextLayout, bounds: TextBounds): Texture | null;
}

/** Drawn area in the text node's local space, centimeters, y up. */
export interface TextBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Glyph em height as a fraction of the line advance. */
const EM_PER_LINE = 1 / LINE_ADVANCE_EMS;
/** Canvas pixels per centimeter. */
const PX_PER_CM = 24;
const MAX_CANVAS_PX = 4096;

/** CSS font family for a manifest family; the Lens default font maps to a system sans. */
export function cssFontFamily(family: string | undefined): string {
  const fallback = '"Inter", "Helvetica Neue", Arial, sans-serif';
  return family === undefined ? fallback : JSON.stringify(family) + ", " + fallback;
}

const cssFont = (font: TextFont, px: number): string =>
  (font.italic ? "italic " : "") + font.weight + " " + px.toFixed(2) + "px " + cssFontFamily(font.family);

/** Left x of a line inside the layout rect, cm. */
export function lineStartX(layout: TextLayout, lineWidthCm: number): number {
  const half = layout.rectWidthCm / 2;
  if (layout.horizontalAlignment === "left") return -half;
  if (layout.horizontalAlignment === "right") return half - lineWidthCm;
  return -lineWidthCm / 2;
}

/** Top y of the text block inside the layout rect, cm. */
export function blockTopY(layout: TextLayout): number {
  const half = layout.rectHeightCm / 2;
  const blockHeight = layout.lines.length * layout.lineHeightCm;
  if (layout.verticalAlignment === "top") return half;
  if (layout.verticalAlignment === "bottom") return -half + blockHeight;
  return blockHeight / 2;
}

/** Union of the layout rect and the text block, so overflowing text is drawn as Lens draws it. */
export function textBounds(layout: TextLayout, measure: MeasureTextCm): TextBounds {
  let minX = -layout.rectWidthCm / 2;
  let maxX = layout.rectWidthCm / 2;
  let maxY = layout.rectHeightCm / 2;
  let minY = -layout.rectHeightCm / 2;
  const top = blockTopY(layout);
  layout.lines.forEach((line, i) => {
    const w = measure(line, layout.font, layout.lineHeightCm);
    const x = lineStartX(layout, w);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, top - i * layout.lineHeightCm);
    minY = Math.min(minY, top - (i + 1) * layout.lineHeightCm);
  });
  return { minX, maxX, minY, maxY };
}

/** Rasterizer over an HTML canvas. */
export function createCanvasRasterizer(doc: Document = document): TextRasterizer {
  const probe = doc.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("2D canvas is unavailable; the preview cannot draw text.");
  const measure: MeasureTextCm = (text, font, lineHeightCm) => {
    const px = 100;
    probe.font = cssFont(font, px);
    return (probe.measureText(text).width / px) * lineHeightCm * EM_PER_LINE;
  };
  return {
    measure,
    draw(layout, bounds) {
      const canvas = doc.createElement("canvas");
      const widthCm = bounds.maxX - bounds.minX;
      const heightCm = bounds.maxY - bounds.minY;
      const scale = Math.min(PX_PER_CM, MAX_CANVAS_PX / Math.max(widthCm, heightCm, 1e-3));
      canvas.width = Math.max(1, Math.ceil(widthCm * scale));
      canvas.height = Math.max(1, Math.ceil(heightCm * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const emPx = layout.lineHeightCm * EM_PER_LINE * scale;
      ctx.font = cssFont(layout.font, emPx);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      const top = blockTopY(layout);
      layout.lines.forEach((line, i) => {
        const w = measure(line, layout.font, layout.lineHeightCm);
        const x = (lineStartX(layout, w) - bounds.minX) * scale;
        const yCm = top - (i + 0.5) * layout.lineHeightCm;
        ctx.fillText(line, x, (bounds.maxY - yCm) * scale);
      });
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      return texture;
    },
  };
}

/** Rasterizer without a canvas: every glyph advances half the em. For Node tests. */
export function createFixedAdvanceRasterizer(): TextRasterizer {
  return {
    measure: (text, _font, lineHeightCm) => text.length * lineHeightCm * EM_PER_LINE * 0.5,
    draw: () => null,
  };
}
