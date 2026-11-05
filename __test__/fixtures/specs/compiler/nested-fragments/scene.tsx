import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="outer">
        <>
          <ViroText viroTag="one" text="one" />
          <React.Fragment>
            <ViroText viroTag="two" text="two" />
          </React.Fragment>
        </>
      </ViroNode>
    </ViroSpecsScene>
  );
}
