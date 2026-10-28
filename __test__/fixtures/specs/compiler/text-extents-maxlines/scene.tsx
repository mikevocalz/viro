import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="box" text="A longer caption" width={0.6} height={0.2} maxLines={2} />
    </ViroSpecsScene>
  );
}
