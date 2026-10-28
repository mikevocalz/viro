import * as React from "react";
import { ViroNode, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="all" rotation={[30, 45, 60]} />
    </ViroSpecsScene>
  );
}
