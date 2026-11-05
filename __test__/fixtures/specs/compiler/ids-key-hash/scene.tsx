import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="left">
        <ViroText key="0" text="same" />
      </ViroNode>
      <ViroNode viroTag="right">
        <ViroText key="0" text="same" />
      </ViroNode>
    </ViroSpecsScene>
  );
}
