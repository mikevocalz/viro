import * as React from "react";
import { ViroNode, ViroPolyline, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="root" position={[0.25, 1.5, -2]}>
        <ViroText viroTag="label" text="25 cm right" position={[0.25, 0, 0]} width={0.4} height={0.1} />
        <ViroPolyline viroTag="ruler" points={[[0, 0, 0], [1, 0, 0]]} thickness={0.02} />
      </ViroNode>
    </ViroSpecsScene>
  );
}
