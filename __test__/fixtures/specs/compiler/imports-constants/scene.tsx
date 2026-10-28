import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
import { LABELS, POSITION } from "./constants";
import * as Theme from "./theme";
import copy from "./copy.json";

const { offset: OFFSET } = Theme.LAYOUT;

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="imported" position={POSITION}>
        <ViroText viroTag="title" text={LABELS.title} style={Theme.TITLE_STYLE} />
        <ViroText viroTag="subtitle" text={copy.subtitle} position={[0, OFFSET, 0]} />
      </ViroNode>
    </ViroSpecsScene>
  );
}
