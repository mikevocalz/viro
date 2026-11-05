import * as React from "react";
import { ViroPolyline, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroPolyline viroTag="line" points={[[0, 0, -1], [1, 0, -1]]}>
        <ViroText viroTag="inside" text="lost" />
      </ViroPolyline>
    </ViroSpecsScene>
  );
}
