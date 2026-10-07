import * as React from "react";
import type { ViroTextStyle } from "../Styles/ViroTextStyle";
import type { Viro3DPoint } from "../Types/ViroUtils";
import { ViroText } from "../ViroText";
type Props = {
    text: string;
    position: Viro3DPoint;
    /** Metres, like ViroText's. */
    width: number;
    height: number;
    fontSize: number;
    style?: Omit<ViroTextStyle, "fontSize">;
    onClick?: React.ComponentProps<typeof ViroText>["onClick"];
};
/**
 * A ViroText that reads sharply in a headset. textClipMode is always "None":
 * ViroText drops a line taller than its box, and the line height of a large
 * raster differs from the one each box was sized for.
 */
export declare function StudioQuestText({ text, position, width, height, fontSize, style, onClick, }: Props): React.JSX.Element;
export {};
