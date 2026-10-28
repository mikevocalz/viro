import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="lossy" text="lossy" style={{ fontSize: 20, color: "white", letterSpacing: 2 }} />
    </ViroSpecsScene>
  );
}
