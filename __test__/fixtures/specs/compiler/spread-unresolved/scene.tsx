import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene(rest: Record<string, unknown>) {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="spread" text="x" {...rest} />
    </ViroSpecsScene>
  );
}
