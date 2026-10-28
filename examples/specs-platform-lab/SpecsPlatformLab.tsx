import * as React from "react";
import {
  ModelViewer,
  PanelButton,
  PanelText,
  SpatialPanel,
  ViroAnimations,
  ViroPolyline,
  ViroSpecsScene,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "../../index";
import { VIRO_SPECS_COPY } from "../../components/Specs/core/copy";

// Runs once when the scene is ready (critique: a looping pulse on the only
// text in view keeps pulling the eye). 500 ms EaseInEaseOut is the motion cap.
ViroAnimations.registerAnimations({
  platformLabPulse: {
    properties: {
      scaleX: 1.15,
      scaleY: 1.15,
      scaleZ: 1.15,
      opacity: 0.8,
    },
    duration: 500,
    easing: "EaseInEaseOut",
  },
});

export type SpecsPlatformLabProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onSelect?: () => void;
  onDrag?: (position: [number, number, number]) => void;
  onNext?: () => void;
};

/**
 * Platform Lab gallery, scene 1: Hello (`docs/ux/handoff/hello.md`).
 *
 * One scene source for ViroCore and SPECS. ViroCore targets render the
 * children normally; SPECS compiles the same JSX into the portable scene the
 * Lens host renders. The other gallery scenes are `PlacementScene`,
 * `InteractionScene` and `NavigationScene` next to this file.
 */
export function SpecsPlatformLab({
  transport,
  sourceResolver,
  onSelect,
  onDrag,
  onNext,
}: SpecsPlatformLabProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <SpatialPanel viroTag="platform-lab-root" position={[0, 0, -1.5]} width={0.53} height={0.42}>
        <PanelText
          viroTag="platform-lab-title"
          role="title"
          text={VIRO_SPECS_COPY["gallery.hello.title"]}
          position={[0, 0.15, 0.005]}
          animation={{ name: "platformLabPulse", run: true }}
        />
        <PanelText
          viroTag="hello-body"
          role="body"
          tone="muted"
          text={VIRO_SPECS_COPY["gallery.hello.body"]}
          position={[0, 0.07, 0.005]}
          width={0.46}
          height={0.1}
          maxLines={2}
        />
        <ModelViewer
          viroTag="platform-lab-model"
          label={VIRO_SPECS_COPY["gallery.hello.model"]}
          source={require("../visionos-sweep/assets/shiba.glb")}
          type="GLB"
          position={[-0.2, -0.05, 0.005]}
          scale={[0.18, 0.18, 0.18]}
          onClick={() => onSelect?.()}
          onDrag={(position) => onDrag?.(position)}
        />
        <ViroPolyline
          viroTag="platform-lab-route"
          points={[
            [-0.3, -0.2, 0.12],
            [0, 0.02, 0.12],
            [0.3, -0.08, 0.12],
          ]}
          thickness={0.008}
        />
        <PanelButton
          viroTag="hello-next"
          label={VIRO_SPECS_COPY["nav.next"]}
          position={[0.15, -0.16, 0.005]}
          onPress={() => onNext?.()}
        />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
