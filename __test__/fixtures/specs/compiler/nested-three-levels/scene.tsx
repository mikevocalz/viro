import * as React from "react";
import { ViroNode, ViroPolyline, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="a" position={[0, 1, 0]} scale={[2, 2, 2]}>
        <ViroNode viroTag="b" position={[0.5, 0, 0]} rotation={[0, 0, 90]}>
          <ViroNode viroTag="c" position={[0, 0.25, 0]} scale={[0.5, 0.5, 0.5]}>
            <ViroText viroTag="leaf" text="leaf" />
            <ViroPolyline viroTag="tip" points={[[0, 0, 0], [1, 0, 0]]} thickness={0.02} />
          </ViroNode>
        </ViroNode>
      </ViroNode>
    </ViroSpecsScene>
  );
}
