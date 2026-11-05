import * as React from "react";
import { ViroSpecsScene, ViroText } from "../viro";

const transport = { applyScene() {} };

export function Scene({ user, x }: { user: { name: string }; x: number }) {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="dyn" text={user.name} position={[x, 0, -1]} />
    </ViroSpecsScene>
  );
}
