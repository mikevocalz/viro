/**
 * Web implementation of ViroText — a text geometry rendered by the WASM font
 * pipeline (freetype + preloaded Roboto). Maps `text`, `style` (fontSize,
 * color), `width`/`height`, alignment, line-break, clip and `maxLines` onto the
 * `viroCreateText` C API.
 *
 * MVP scope: single typeface (preloaded system font); custom `fontFamily`,
 * `extrusionDepth` and `outerStroke` are follow-ups.
 */
import * as React from "react";
import { useMemo } from "react";
import { ViroTextHorizontalAlignment, ViroTextVerticalAlignment, ViroLineBreakMode, ViroTextClipMode, } from "@reactvision/viro-web-renderer";
import { useViroNode } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { ViroParentNodeContext } from "./Web/ViroWebContext";
import { parseColorToRGBA } from "./Web/viroColor";
function hAlign(v) {
    switch ((v ?? "").toLowerCase()) {
        case "right":
            return ViroTextHorizontalAlignment.Right;
        case "center":
            return ViroTextHorizontalAlignment.Center;
        default:
            return ViroTextHorizontalAlignment.Left;
    }
}
function vAlign(v) {
    switch ((v ?? "").toLowerCase()) {
        case "bottom":
            return ViroTextVerticalAlignment.Bottom;
        case "center":
            return ViroTextVerticalAlignment.Center;
        default:
            return ViroTextVerticalAlignment.Top;
    }
}
function lineBreak(v) {
    switch (v) {
        case "CharWrap":
            return ViroLineBreakMode.CharWrap;
        case "Justify":
            return ViroLineBreakMode.Justify;
        case "None":
            return ViroLineBreakMode.None;
        default:
            return ViroLineBreakMode.WordWrap;
    }
}
export function ViroText(props) {
    const { text, maxLines = 0, style, } = props;
    // Inside a ViroFlexView the layout decides the text box, as it does natively:
    // the block still wraps and clips to it, it just no longer sizes itself.
    const slot = useViroFlexSlot();
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? 1;
    const fontSize = style?.fontSize ?? 18;
    const colorValue = props.color ?? style?.color ?? "#ffffff";
    const clip = props.textClipMode === "None" ? ViroTextClipMode.None : ViroTextClipMode.ClipToBounds;
    // Recreate the geometry when any text-shaping input changes.
    const key = useMemo(() => [
        text,
        width,
        height,
        fontSize,
        String(colorValue),
        style?.textAlign,
        style?.textAlignVertical,
        props.textLineBreakMode,
        props.textClipMode,
        maxLines,
    ].join("|"), [text, width, height, fontSize, colorValue, style?.textAlign, style?.textAlignVertical, props.textLineBreakMode, props.textClipMode, maxLines]);
    const node = useViroNode(props, (scene) => {
        const [r, g, b, a] = parseColorToRGBA(colorValue);
        return scene.createText(text ?? "", width, height, fontSize, hAlign(style?.textAlign), vAlign(style?.textAlignVertical), lineBreak(props.textLineBreakMode), clip, maxLines, { r, g, b, a });
    }, true, 
    // Rebuild the text geometry when shaping inputs change.
    key);
    return (<ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>);
}
