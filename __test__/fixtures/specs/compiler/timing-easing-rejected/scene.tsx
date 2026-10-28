import * as React from "react";
import { ViroAnimations, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenBounce: { properties: { scaleX: 2 }, duration: 300, easing: "Bounce" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="bouncy" text="x" animation={{ name: "goldenBounce", run: true }} />
    </ViroSpecsScene>
  );
}
