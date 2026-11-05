import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="toggle" text="toggle" onClickState={() => {}} />
    </ViroSpecsScene>
  );
}
