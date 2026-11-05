import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
const SHOW_DEBUG = false;

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      {SHOW_DEBUG ? <ViroText viroTag="debug" text="debug" /> : <ViroText viroTag="release" text="release" />}
    </ViroSpecsScene>
  );
}
