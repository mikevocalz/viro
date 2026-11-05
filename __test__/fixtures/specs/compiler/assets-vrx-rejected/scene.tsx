import * as React from "react";
import { Viro3DObject, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <Viro3DObject viroTag="legacy" source={require("../assets/legacy.vrx")} type="VRX" />
    </ViroSpecsScene>
  );
}
