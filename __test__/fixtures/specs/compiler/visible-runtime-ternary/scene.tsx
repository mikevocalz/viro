import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene({ expanded }: { expanded: boolean }) {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroNode viroTag="panel">
        {expanded ? (
          <ViroNode viroTag="details">
            <ViroText viroTag="body" text="Details" />
          </ViroNode>
        ) : (
          <ViroText viroTag="summary" text="Summary" />
        )}
      </ViroNode>
    </ViroSpecsScene>
  );
}
