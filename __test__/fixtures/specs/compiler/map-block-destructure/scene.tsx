import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
const ROWS = [
  { label: "top", y: 0.2 },
  { label: "bottom", y: -0.2 },
] as const;

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      {ROWS.map(({ label, y }) => {
        return <ViroText key={label} viroTag={"row-" + label} text={label} position={[0, y, -1]} />;
      })}
    </ViroSpecsScene>
  );
}
