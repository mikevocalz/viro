import * as React from "react";
import { ViroAnimations, ViroNode, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenLift: { properties: { translateY: 0.2 }, duration: 250, easing: "EaseIn" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="lift" position={[0, 1, -1]} animation={{ name: "goldenLift", run: true }} />
    </ViroSpecsScene>
  );
}
