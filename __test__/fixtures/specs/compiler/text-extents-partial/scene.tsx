import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="half" text="half" width={0.6} />
    </ViroSpecsScene>
  );
}
