import * as React from "react";
import { ViroNode, ViroPolyline, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="arm" position={[1, 0, -2]} rotation={[0, 90, 0]}>
        <ViroPolyline viroTag="reach" points={[[0, 0, 0], [1, 0, 0]]} thickness={0.01} />
      </ViroNode>
    </ViroSpecsScene>
  );
}
