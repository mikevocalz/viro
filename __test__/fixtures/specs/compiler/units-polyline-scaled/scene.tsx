import * as React from "react";
import { ViroNode, ViroPolyline, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="scaled" scale={[2, 0.5, 1]} position={[0, 0, -1]}>
        <ViroPolyline viroTag="line" points={[[0, 0, 0], [0.5, 0.5, 0]]} thickness={0.01} />
      </ViroNode>
    </ViroSpecsScene>
  );
}
