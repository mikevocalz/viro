import * as React from "react";
import { Viro3DObject, ViroImage, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <Viro3DObject viroTag="cube" source={require("../assets/cube.glb")} type="GLB" />
      <ViroImage viroTag="poster" source={require("../assets/panel.png")} width={0.3} height={0.2} />
    </ViroSpecsScene>
  );
}
