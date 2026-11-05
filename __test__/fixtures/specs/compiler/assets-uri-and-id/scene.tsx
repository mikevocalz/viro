import * as React from "react";
import { Viro3DObject, ViroImage, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <Viro3DObject viroTag="remote" source={{ uri: "https://cdn.example.com/robot.glb" }} type="glb" />
      <ViroImage viroTag="lens-asset" source="lens:poster-texture" />
    </ViroSpecsScene>
  );
}
