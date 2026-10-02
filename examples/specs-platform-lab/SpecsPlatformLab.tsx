import * as React from "react";
import {
  Viro3DObject,
  ViroAnimations,
  ViroNode,
  ViroPolyline,
  ViroSpecsScene,
  ViroText,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "../../index";

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
};

/**
 * One scene source for ViroCore and SPECS.
 *
 * ViroCore targets render the children normally. SPECS compiles the same JSX
 * into the portable scene consumed by the Lens Studio backend.
 */
export function SpecsPlatformLab({
  transport,
  sourceResolver,
  onSelect,
  onDrag,
}: SpecsPlatformLabProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <ViroNode viroTag="platform-lab-root" position={[0, 0, -1.5]}>
        <ViroText
          viroTag="platform-lab-title"
          text="Viro Cross-Platform Lab"
          position={[0, 0.25, 0]}
          animation={{
            name: "platformLabPulse",
            run: true,
            loop: true,
          }}
        />

        <Viro3DObject
          viroTag="platform-lab-model"
          source={require("../visionos-sweep/assets/shiba.glb")}
          type="GLB"
          position={[-0.2, -0.05, 0]}
          scale={[0.18, 0.18, 0.18]}
          onClick={() => onSelect?.()}
          onDrag={(position) =>
            onDrag?.(position as [number, number, number])
          }
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
      </ViroNode>
    </ViroSpecsScene>
  );
}
