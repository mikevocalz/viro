import * as React from "react";
import { ViroPolyline, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroPolyline viroTag="thin" points={[[0, 0, -1], [0, 1, -1]]} />
    </ViroSpecsScene>
  );
}
