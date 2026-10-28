import * as React from "react";
import { ViroNode, ViroPolyline, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="xy" rotation={[90, 90, 0]}>
        <ViroPolyline viroTag="probe" points={[[0, 0, 0], [0, 1, 0]]} thickness={0.01} />
      </ViroNode>
    </ViroSpecsScene>
  );
}
