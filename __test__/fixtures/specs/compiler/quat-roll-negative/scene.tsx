import * as React from "react";
import { ViroNode, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="roll" rotation={[0, 0, -45]} />
    </ViroSpecsScene>
  );
}
