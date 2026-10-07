import * as React from "react";
import { ViroNode } from "../ViroNode";
import { ViroText } from "../ViroText";
// ViroText rasterises a glyph at fontSize pixels and stretches it over fontSize
// centimetres, about 2 texels per degree at the panels' 1.2 m. Drawing at
// SUPERSAMPLE times the size under a 1/SUPERSAMPLE scale keeps the world size
// and multiplies the texels: 8 gives about 17 per degree there.
const SUPERSAMPLE = 8;
const INVERSE = 1 / SUPERSAMPLE;
/**
 * A ViroText that reads sharply in a headset. textClipMode is always "None":
 * ViroText drops a line taller than its box, and the line height of a large
 * raster differs from the one each box was sized for.
 */
export function StudioQuestText({ text, position, width, height, fontSize, style, onClick, }) {
    return (<ViroNode position={position} scale={[INVERSE, INVERSE, INVERSE]}>
      <ViroText text={text} width={width * SUPERSAMPLE} height={height * SUPERSAMPLE} textClipMode="None" onClick={onClick} 
    // The native side reads the size as an integer.
    style={{ ...style, fontSize: Math.round(fontSize * SUPERSAMPLE) }}/>
    </ViroNode>);
}
