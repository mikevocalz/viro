import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene({ items }: { items: string[] }) {
  return (
    <ViroSpecsScene transport={transport}>
      {items.map((item) => <ViroText key={item} viroTag={item} text={item} />)}
    </ViroSpecsScene>
  );
}
