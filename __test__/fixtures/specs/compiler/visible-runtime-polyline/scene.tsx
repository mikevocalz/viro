import * as React from "react";
import { ViroPolyline, ViroSpecsScene } from "../viro";

const transport = { applyScene() {} };

export function Scene({ showRoute }: { showRoute: boolean }) {
  return (
    <ViroSpecsScene transport={transport}>
      {showRoute && <ViroPolyline viroTag="route" points={[[0, 0, -1], [1, 0, -1]]} />}
    </ViroSpecsScene>
  );
}
