import * as React from "react";
import { ViroAnimations, ViroNode, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenTurn: { properties: { rotateY: "+=45" }, duration: 1000, easing: "EaseInEaseOut" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="turn" rotation={[0, 30, 0]} animation={{ name: "goldenTurn", run: true, loop: true }} />
    </ViroSpecsScene>
  );
}
