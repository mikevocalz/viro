import * as React from "react";
import {
  Viro3DObject,
  ViroARScene,
  ViroNode,
  ViroPolyline,
  ViroText,
  compileViroSpecsJSX,
} from "../../index";

export interface ViroSpecsPlatformLabProps {
  onSelect?: () => void;
  onModelDrag?: (position: [number, number, number]) => void;
}

/**
 * One Viro-authored scene used for ViroCore targets and SPECS export.
 */
export function ViroSpecsPlatformLabScene(
  props: ViroSpecsPlatformLabProps = {}
): React.ReactElement {
  return (
    <ViroARScene>
      <ViroNode viroTag="platform-lab-root" position={[0, 0, -1.5]}>
        <ViroText
          viroTag="platform-lab-title"
          text="Viro Cross-Platform Platform Lab"
          position={[0, 0.25, 0]}
        />
        <Viro3DObject
          viroTag="platform-lab-model"
          type="GLB"
          source={{ uri: "platform-lab-model" }}
          position={[-0.2, -0.05, 0]}
          scale={[0.18, 0.18, 0.18]}
          onDrag={(position) => props.onModelDrag?.(position)}
        />
        <ViroNode
          viroTag="platform-lab-button"
          position={[0.24, -0.14, 0]}
          onClick={() => props.onSelect?.()}
        >
          <ViroText
            viroTag="platform-lab-button-label"
            text="Select"
          />
        </ViroNode>
        <ViroPolyline
          viroTag="platform-lab-route"
          points={[
            [-0.3, -0.28, 0.12],
            [0, -0.06, 0.12],
            [0.3, -0.12, 0.12],
          ]}
          thickness={0.008}
        />
      </ViroNode>
    </ViroARScene>
  );
}

export function compileViroSpecsPlatformLab() {
  return compileViroSpecsJSX(ViroSpecsPlatformLabScene(), {
    resolveAssetId(_source, { id }) {
      return id;
    },
  });
}
