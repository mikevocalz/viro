import * as React from "react";
import { ViroAnimations, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenNegative: { properties: { scaleX: 2 }, duration: -5, easing: "Linear" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="bad-timing" text="x" animation={{ name: "goldenNegative", run: true }} />
    </ViroSpecsScene>
  );
}
