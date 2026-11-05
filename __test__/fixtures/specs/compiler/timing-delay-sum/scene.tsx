import * as React from "react";
import { ViroAnimations, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenDelayed: { properties: { scaleX: 1.1 }, duration: 750, delay: 200, easing: "Linear" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="late" text="late" animation={{ name: "goldenDelayed", run: true, delay: 100, loop: true }} />
    </ViroSpecsScene>
  );
}
