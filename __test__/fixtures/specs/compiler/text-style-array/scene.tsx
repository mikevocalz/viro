import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
const BASE = { fontSize: 18, color: "#ff0000", textAlign: "left" } as const;

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="merged" text="merged" style={[BASE, false, { color: "#00ff00" }]} />
    </ViroSpecsScene>
  );
}
