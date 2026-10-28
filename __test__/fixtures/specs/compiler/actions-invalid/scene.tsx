import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport} actions={[{ id: "a.b" }]}>
      <ViroText viroTag="nested" text="x" specsAction={{ actionId: "a.b", payload: { go: { deep: 1 } } }} />
      <ViroText viroTag="undeclared" text="y" specsAction={{ actionId: "c.d" }} />
    </ViroSpecsScene>
  );
}
