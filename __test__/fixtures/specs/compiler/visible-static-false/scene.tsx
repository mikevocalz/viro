import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="shown">
        <ViroText viroTag="hidden" text="hidden" visible={false} />
      </ViroNode>
    </ViroSpecsScene>
  );
}
