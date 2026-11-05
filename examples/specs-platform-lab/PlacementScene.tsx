import * as React from "react";
import {
  ModelViewer,
  PanelButton,
  PanelText,
  SpatialPanel,
  ViroSpecsScene,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "../../index";
import { VIRO_SPECS_COPY } from "../../components/Specs/core/copy";

export type PlacementSceneProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onReset?: () => void;
  onNext?: () => void;
};

/**
 * Platform Lab gallery, scene 2: Placement (`docs/ux/handoff/placement.md`).
 *
 * The reticle, surface tint, pinch confirm and look-away cancel are drawn by
 * the experience layer in `@viro-external/specs`, not by this JSX. The scene
 * declares the model to place (hidden until a placement confirms) and the
 * control panel at 1.0 m, below eye line. "Reset model" starts hidden and the
 * host shows it after the first placement.
 */
export function PlacementScene({ transport, sourceResolver, onReset, onNext }: PlacementSceneProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <ModelViewer
        viroTag="placement-model"
        label={VIRO_SPECS_COPY["gallery.hello.model"]}
        source={require("../visionos-sweep/assets/shiba.glb")}
        type="GLB"
        position={[0, -0.3, -1.5]}
        scale={[0.18, 0.18, 0.18]}
        visible={false}
        resettable={false}
      />
      <SpatialPanel viroTag="placement-panel" position={[0, -0.35, -0.95]} width={0.35} height={0.2}>
        <PanelText
          viroTag="placement-title"
          role="title"
          text={VIRO_SPECS_COPY["gallery.placement.title"]}
          position={[0, 0.055, 0.005]}
        />
        <PanelButton
          viroTag="placement-reset"
          label={VIRO_SPECS_COPY["modelViewer.reset"]}
          position={[-0.08, -0.05, 0.005]}
          visible={false}
          onPress={() => onReset?.()}
        />
        <PanelButton
          viroTag="placement-next"
          label={VIRO_SPECS_COPY["nav.next"]}
          position={[0.08, -0.05, 0.005]}
          onPress={() => onNext?.()}
        />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
