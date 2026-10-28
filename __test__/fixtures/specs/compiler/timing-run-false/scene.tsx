import * as React from "react";
import { ViroAnimations, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenIdle: { properties: { scaleX: 2 }, duration: 300, easing: "Linear" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="idle" text="x" animation={{ name: "goldenIdle", run: false }} />
    </ViroSpecsScene>
  );
}
