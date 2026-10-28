import * as React from "react";
import { ViroAnimations, ViroNode, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenScaleMix: { properties: { scaleX: "*=2", scaleY: "/=4", scaleZ: 3 }, duration: 300, easing: "EaseOut" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="grow" scale={[0.5, 2, 1]} animation={{ name: "goldenScaleMix", run: true }} />
    </ViroSpecsScene>
  );
}
