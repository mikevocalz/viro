import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
const BASE_TEXT = { text: "base", position: [0, 0.5, -1] as [number, number, number], style: { fontSize: 12 } };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText {...BASE_TEXT} viroTag="spread" text="override" />
    </ViroSpecsScene>
  );
}
