import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
const ITEMS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="list" position={[0, 0, -1]}>
        {ITEMS.map((item, index) => (
          <ViroText key={item.id} viroTag={`item-${item.id}`} text={item.label} position={[0, index * -0.1, 0]} />
        ))}
      </ViroNode>
    </ViroSpecsScene>
  );
}
