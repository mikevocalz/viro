import * as React from "react";
import { Viro3DObject, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };
import cube from "../assets/cube.glb";

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <Viro3DObject viroTag="cube" source={cube} type="GLB" />
    </ViroSpecsScene>
  );
}
