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

export type InteractionSceneProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onOption?: (option: "a" | "b") => void;
  onRetry?: () => void;
  onDrag?: (position: [number, number, number]) => void;
  onReset?: () => void;
  onNext?: () => void;
};

/**
 * Platform Lab gallery, scene 3: Interaction (`docs/ux/handoff/interaction.md`).
 *
 * The button grid holds one PanelButton per state that can sit still: idle
 * (Option A), selected (Option B), disabled (Option C) and error (Retry).
 * Hover and pressed appear on whichever button the wearer targets; loading
 * appears on Retry after it is pressed. When hand tracking is off the host
 * adds the gaze-only Move buttons under the model.
 */
export function InteractionScene({ transport, sourceResolver, onOption, onRetry, onDrag, onReset, onNext }: InteractionSceneProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <SpatialPanel viroTag="ix-panel" position={[0, 0, -1.5]} width={0.53} height={0.6}>
        <PanelText viroTag="ix-title" role="title" text={VIRO_SPECS_COPY["gallery.interaction.title"]} position={[0, 0.24, 0.005]} />
        <PanelText
          viroTag="ix-body"
          role="body"
          tone="muted"
          text={VIRO_SPECS_COPY["gallery.interaction.body"]}
          position={[0, 0.175, 0.005]}
          width={0.46}
          height={0.05}
          maxLines={1}
        />
        <PanelButton viroTag="ix-btn-a" label={VIRO_SPECS_COPY["gallery.interaction.optionA"]} position={[-0.125, 0.095, 0.005]} width={0.23} onPress={() => onOption?.("a")} />
        <PanelButton
          viroTag="ix-btn-b"
          label={VIRO_SPECS_COPY["gallery.interaction.optionB"]}
          state="selected"
          position={[0.125, 0.095, 0.005]}
          width={0.23}
          onPress={() => onOption?.("b")}
        />
        <PanelButton
          viroTag="ix-btn-disabled"
          label={VIRO_SPECS_COPY["gallery.interaction.optionC"]}
          state="disabled"
          position={[-0.125, -0.01, 0.005]}
          width={0.23}
        />
        <PanelButton
          viroTag="ix-btn-retry"
          label={VIRO_SPECS_COPY["gallery.interaction.retry"]}
          state="error"
          errorMessage={VIRO_SPECS_COPY["gallery.interaction.retryFailed"]}
          position={[0.125, -0.01, 0.005]}
          width={0.23}
          onPress={() => onRetry?.()}
        />
        <ModelViewer
          viroTag="ix-model"
          label={VIRO_SPECS_COPY["gallery.hello.model"]}
          source={require("../visionos-sweep/assets/shiba.glb")}
          type="GLB"
          position={[-0.14, -0.17, 0.06]}
          scale={[0.12, 0.12, 0.12]}
          onDrag={(position) => onDrag?.(position)}
        />
        <PanelButton viroTag="ix-reset" label={VIRO_SPECS_COPY["modelViewer.reset"]} position={[0.13, -0.12, 0.005]} width={0.23} onPress={() => onReset?.()} />
        <PanelButton viroTag="ix-next" label={VIRO_SPECS_COPY["nav.next"]} position={[0.13, -0.225, 0.005]} width={0.23} onPress={() => onNext?.()} />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
