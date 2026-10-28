import * as React from "react";
import { ViroAmbientLight, ViroDirectionalLight, ViroNode, ViroOmniLight, ViroSpecsScene, ViroSpotLight } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="rig" position={[0, 2, 0]}>
        <ViroAmbientLight viroTag="fill" color="#ffffff" intensity={200} />
        <ViroDirectionalLight viroTag="sun" direction={[0, -1, -0.5]} />
        <ViroOmniLight viroTag="bulb" position={[0, 0.5, 0]} intensity={800} />
        <ViroSpotLight viroTag="spot" innerAngle={10} outerAngle={30} color="#ffcc00" />
      </ViroNode>
    </ViroSpecsScene>
  );
}
