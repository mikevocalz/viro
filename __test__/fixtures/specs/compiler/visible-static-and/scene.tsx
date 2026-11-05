import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };
const FLAGS = { badge: true, banner: false } as const;

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      {FLAGS.badge && <ViroText viroTag="badge" text="new" />}
      {FLAGS.banner && <ViroText viroTag="banner" text="sale" />}
    </ViroSpecsScene>
  );
}
