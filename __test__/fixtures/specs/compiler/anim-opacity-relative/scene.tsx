import * as React from "react";
import { ViroAnimations, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
ViroAnimations.registerAnimations({
  goldenFade: { properties: { opacity: "-=0.25" }, duration: 200 },
});

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="fade" text="fade" opacity={0.75} animation={{ name: "goldenFade", run: true }} />
    </ViroSpecsScene>
  );
}
