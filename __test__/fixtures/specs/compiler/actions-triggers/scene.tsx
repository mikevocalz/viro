import * as React from "react";
import { ViroNode, ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

const ACTIONS = [
  { id: "exhibit.open", payload: { exhibitId: { type: "string" } } },
  { id: "settings.units", payload: { units: { type: "string", enum: ["metric", "imperial"] } } },
  { id: "nav.back" },
];

export function Scene() {
  return (
    <ViroSpecsScene transport={transport} route="list" actions={ACTIONS}>
      <ViroNode viroTag="list" specsScroll={{ width: 0.4, height: 0.3, contentHeight: 0.9 }}>
        <ViroText viroTag="card-orrery" text="Orrery" specsAction={{ actionId: "exhibit.open", payload: { exhibitId: "orrery" } }} />
        <ViroText
          viroTag="units"
          text="Imperial"
          onClick={() => {}}
          specsAction={[
            { actionId: "settings.units", payload: { units: "imperial" } },
            { actionId: "nav.back", on: "hover-enter" },
          ]}
        />
      </ViroNode>
    </ViroSpecsScene>
  );
}
