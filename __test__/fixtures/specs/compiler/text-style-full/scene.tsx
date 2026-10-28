import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText
        viroTag="styled"
        text="Styled"
        style={{
          fontFamily: "Inter",
          fontSize: 24,
          fontWeight: 600,
          fontStyle: "italic",
          color: "#FA0",
          textAlign: "center",
          textAlignVertical: "top",
        }}
      />
    </ViroSpecsScene>
  );
}
