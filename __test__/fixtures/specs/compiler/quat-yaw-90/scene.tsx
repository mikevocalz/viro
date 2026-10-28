import * as React from "react";
import { ViroNode, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="yaw" rotation={[0, 90, 0]} />
    </ViroSpecsScene>
  );
}
