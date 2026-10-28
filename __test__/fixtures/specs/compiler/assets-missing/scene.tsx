import * as React from "react";
import { Viro3DObject, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <Viro3DObject viroTag="ghost" source={require("../assets/missing.glb")} type="GLB" />
    </ViroSpecsScene>
  );
}
