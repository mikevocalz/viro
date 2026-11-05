import * as React from "react";
import { Viro3DObject, ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode>
        <ViroText text="Hello" />
        <ViroText text="World" />
        <ViroText text="Hello" />
        <Viro3DObject source={require("../assets/cube.glb")} type="GLB" />
      </ViroNode>
    </ViroSpecsScene>
  );
}
