// A Specs scene as an app outside this repo writes it: every import comes
// from the installed package. scripts/check-specs-consumer.cjs type-checks
// it against the packed declarations and compiles it with the installed
// viro-specs-compile.
import * as React from "react";
import {
  ModelViewer,
  PanelButton,
  PanelText,
  SpatialPanel,
  ViroPolyline,
  ViroSpecsScene,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "@reactvision/react-viro";

export type ConsumerSceneProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onNext?: () => void;
};

export function ConsumerScene({ transport, sourceResolver, onNext }: ConsumerSceneProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <SpatialPanel viroTag="consumer-root" position={[0, 0, -1.5]} width={0.53} height={0.5}>
        <PanelText viroTag="consumer-title" role="title" text="Installed from a tarball" position={[0, 0.2, 0.005]} />
        <ModelViewer
          viroTag="consumer-model"
          label="Model"
          source={require("./assets/model.glb")}
          type="GLB"
          position={[-0.2, -0.08, 0.005]}
          scale={[0.18, 0.18, 0.18]}
        />
        <ViroPolyline
          viroTag="consumer-route"
          points={[
            [-0.3, -0.2, 0.12],
            [0.3, -0.08, 0.12],
          ]}
          thickness={0.008}
        />
        <PanelButton viroTag="consumer-next" label="Next" position={[0.13, -0.19, 0.005]} onPress={() => onNext?.()} />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
