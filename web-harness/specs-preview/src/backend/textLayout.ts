import type { ViroSpecsBackendText } from "../vendor/lens-core/ViroSpecsSceneBackend";
import { parseViroSpecsColor } from "../vendor/lens-core/ViroSpecsSceneDocument";
import {
  CM_PER_METER,
  DEFAULT_TEXT_HALF_HEIGHT_CM,
  DEFAULT_TEXT_HALF_WIDTH_CM,
  DEFAULT_TEXT_SIZE,
  LINE_HEIGHT_CM_PER_SIZE,
  TEXT_SIZE_PER_POINT,
} from "./lensSemantics";

/** RGBA, each channel 0..1. */
export type Rgba = readonly [number, number, number, number];

/** Measures the advance width of `text` in centimeters at a line height of `lineHeightCm`. */
export type MeasureTextCm = (text: string, font: TextFont, lineHeightCm: number) => number;

/** Font the text renders with. `family` is undefined for the Lens default font. */
export interface TextFont {
  readonly family: string | undefined;
  /** CSS numeric weight, 100..900. */
  readonly weight: number;
  readonly italic: boolean;
}

/**
 * Text after the same resolution the Lens backend's `setText` performs:
 * size, font, color, alignment, layout rect and overflow.
 */
export interface TextLayout {
  readonly text: string;
  /** Lens Text `size`. */
  readonly size: number;
  readonly font: TextFont;
  /** Fill color before node opacity. */
  readonly color: Rgba;
  readonly horizontalAlignment: "left" | "center" | "right";
  readonly verticalAlignment: "top" | "center" | "bottom";
  /** Lens `layoutRect` size, centimeters. */
  readonly rectWidthCm: number;
  readonly rectHeightCm: number;
  /** `wrap` when the node has extents or maxLines; otherwise text runs past the rect. */
  readonly horizontalOverflow: "overflow" | "wrap";
  /** `truncate` when maxLines is set. */
  readonly verticalOverflow: "overflow" | "truncate";
  readonly lineHeightCm: number;
  /** Lines after wrapping and truncation. */
  readonly lines: readonly string[];
  /** True when truncation dropped lines. */
  readonly truncated: boolean;
}

/** Lens Text's default fill color (white). */
export const DEFAULT_TEXT_COLOR: Rgba = [1, 1, 1, 1];

/**
 * Resolves `content` the way `ViroSpecsLensSceneBackend.setText` does and
 * breaks it into lines. `measure` supplies glyph widths (a canvas in the
 * browser, a fixed advance in tests).
 */
export function layoutText(content: ViroSpecsBackendText, measure: MeasureTextCm): TextLayout {
  const style = content.style;
  const size =
    style.fontSize !== undefined ? style.fontSize * TEXT_SIZE_PER_POINT : style.lensSize ?? DEFAULT_TEXT_SIZE;
  const weight =
    style.fontWeight === undefined || style.fontWeight === "normal"
      ? 400
      : style.fontWeight === "bold"
        ? 700
        : Number(style.fontWeight);
  const font: TextFont = { family: content.fontFamily, weight, italic: style.fontStyle === "italic" };
  const color: Rgba = style.color !== undefined ? parseViroSpecsColor(style.color) : style.rgba ?? DEFAULT_TEXT_COLOR;

  let halfWidth = content.extents ? (content.extents.width * CM_PER_METER) / 2 : DEFAULT_TEXT_HALF_WIDTH_CM;
  let halfHeight = content.extents ? (content.extents.height * CM_PER_METER) / 2 : DEFAULT_TEXT_HALF_HEIGHT_CM;
  let horizontalOverflow: TextLayout["horizontalOverflow"] = content.extents ? "wrap" : "overflow";
  let verticalOverflow: TextLayout["verticalOverflow"] = "overflow";
  if (content.maxLines !== undefined) {
    const linesHalf = (content.maxLines * size * LINE_HEIGHT_CM_PER_SIZE) / 2;
    halfHeight = content.extents ? Math.min(halfHeight, linesHalf) : linesHalf;
    horizontalOverflow = "wrap";
    verticalOverflow = "truncate";
  }
  halfWidth = Math.max(0, halfWidth);

  const lineHeightCm = size * LINE_HEIGHT_CM_PER_SIZE;
  const rectWidthCm = halfWidth * 2;
  const rectHeightCm = halfHeight * 2;
  const paragraphs = content.text.split("\n");
  const wrapped =
    horizontalOverflow === "wrap"
      ? paragraphs.flatMap((p) => wrapParagraph(p, rectWidthCm, (s) => measure(s, font, lineHeightCm)))
      : paragraphs;
  let lines = wrapped;
  let truncated = false;
  if (verticalOverflow === "truncate") {
    const fit = Math.max(0, Math.floor(rectHeightCm / lineHeightCm + 1e-6));
    if (lines.length > fit) {
      lines = lines.slice(0, fit);
      truncated = true;
    }
  }
  return {
    text: content.text,
    size,
    font,
    color,
    horizontalAlignment: style.textAlign ?? "center",
    verticalAlignment: style.textAlignVertical ?? "center",
    rectWidthCm,
    rectHeightCm,
    horizontalOverflow,
    verticalOverflow,
    lineHeightCm,
    lines,
    truncated,
  };
}

/** Greedy word wrap; a word wider than the box is split by characters. */
function wrapParagraph(paragraph: string, widthCm: number, width: (s: string) => number): string[] {
  if (paragraph === "") return [""];
  const words = paragraph.split(/(\s+)/).filter((w) => w !== "");
  const lines: string[] = [];
  let line = "";
  const pushWord = (word: string): void => {
    const candidate = line + word;
    if (line === "" || width(candidate.trimEnd()) <= widthCm) {
      line = candidate;
      return;
    }
    lines.push(line.trimEnd());
    line = /^\s+$/.test(word) ? "" : word;
  };
  for (const word of words) {
    if (!/^\s+$/.test(word) && width(word) > widthCm) {
      for (const ch of word) {
        if (line !== "" && width((line + ch).trimEnd()) > widthCm) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += ch;
      }
      continue;
    }
    pushWord(word);
  }
  if (line.trim() !== "" || lines.length === 0) lines.push(line.trimEnd());
  return lines;
}
