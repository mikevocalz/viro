import * as React from "react";
import { ViroAnimations, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenAddSlide: { properties: { positionX: "+=0.5" }, duration: 400, easing: "Linear" },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="slide" text="slide" position={[0.25, 0, -1]} animation={{ name: "goldenAddSlide", run: true }} />
    </ViroSpecsScene>
  );
}
