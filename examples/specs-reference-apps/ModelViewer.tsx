import * as React from "react";
import {
  ModelViewer,
  PanelText,
  SpatialPanel,
  ViroSpecsScene,
  ViroText,
  type ViroSpecsActionEvent,
  type ViroSpecsActionReducers,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "../../index";

/**
 * Reference app 2: a model viewer.
 *
 * A ModelViewer 1.3 m ahead with a control panel below it. The wearer drags
 * the model to move it (the host keeps it inside the 0.6-3.0 m band), and
 * turns, resizes or resets it with typed actions. The Lens host draws the
 * loading ring and, when the GLB is missing, a placeholder with the
 * "Model didn't load" panel and Retry.
 *
 * `resettable` is off because the panel carries its own "Reset model"
 * control, which goes through the actions contract like the others.
 *
 * Asset: `examples/visionos-sweep/assets/shiba.glb`, already in this repo
 * and registered under that ID in the Platform Lab Lens project.
 */

export const MODEL_ACTION_SPEC = {
  "model.turn": { payload: { degrees: { type: "integer" } } },
  "model.resize": { payload: { step: { type: "integer" } } },
  "model.reset": {},
} as const;

/** The same declarations as the literal list `ViroSpecsScene` takes. */
export const MODEL_ACTIONS = [
  { id: "model.turn", payload: { degrees: { type: "integer" } } },
  { id: "model.resize", payload: { step: { type: "integer" } } },
  { id: "model.reset" },
] as const;

export type ModelViewerState = {
  /** Yaw in degrees, kept in [0, 360). */
  readonly yawDegrees: number;
  /** Size steps from the authored scale; each step is 20 %, from -2 to +3. */
  readonly sizeStep: number;
};

export const MODEL_INITIAL_STATE: ModelViewerState = { yawDegrees: 0, sizeStep: 0 };

/** Smallest and largest size step: 60 % to 160 % of the authored scale. */
export const MODEL_SIZE_STEPS = { min: -2, max: 3, percentPerStep: 20 } as const;

/** Authored transform. Reset returns here; the Lens view scales from it. */
export const MODEL_BASE = { position: [0, -0.05, -1.3], scale: 0.2 } as const;

export const MODEL_REDUCERS: ViroSpecsActionReducers<ModelViewerState, typeof MODEL_ACTION_SPEC> = {
  "model.turn": (state, { degrees }) => ({ ...state, yawDegrees: (((state.yawDegrees + degrees) % 360) + 360) % 360 }),
  "model.resize": (state, { step }) => {
    const sizeStep = Math.min(MODEL_SIZE_STEPS.max, Math.max(MODEL_SIZE_STEPS.min, state.sizeStep + step));
    return sizeStep === state.sizeStep ? state : { ...state, sizeStep };
  },
  "model.reset": (state) => (state.yawDegrees === 0 && state.sizeStep === 0 ? state : MODEL_INITIAL_STATE),
};

/** Status line for a state: "Facing front, size 100 %". */
export function modelStatusLine(state: ModelViewerState): string {
  const facing = state.yawDegrees === 0 ? "Facing front" : "Turned " + state.yawDegrees + "°";
  return facing + ", size " + (100 + state.sizeStep * MODEL_SIZE_STEPS.percentPerStep) + " %";
}

const TEXT = "#eef2f0";
const ACCENT = "#f2b544";

// The controls sit about 1.06 m away: 1.2 degrees needs at least 98 points.
const CONTROL_PT = 110;

const CONTROLS = [
  { tag: "mv-turn-left", text: "Turn left", label: "Turn the model left", x: -0.12, y: -0.01, width: 0.2, actionId: "model.turn", payload: { degrees: -45 } },
  { tag: "mv-turn-right", text: "Turn right", label: "Turn the model right", x: 0.12, y: -0.01, width: 0.2, actionId: "model.turn", payload: { degrees: 45 } },
  { tag: "mv-smaller", text: "Smaller", label: "Make the model smaller", x: -0.16, y: -0.08, width: 0.13, actionId: "model.resize", payload: { step: -1 } },
  { tag: "mv-larger", text: "Larger", label: "Make the model larger", x: 0, y: -0.08, width: 0.13, actionId: "model.resize", payload: { step: 1 } },
  { tag: "mv-reset", text: "Reset", label: "Reset model", x: 0.16, y: -0.08, width: 0.13, actionId: "model.reset", payload: {} },
] as const;

export type ModelViewerAppProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onAction?: (event: ViroSpecsActionEvent) => void;
  /** Drag position in meters, already clamped to the comfort band by the Lens host. */
  onDrag?: (position: [number, number, number]) => void;
};

export function ModelViewerApp({ transport, sourceResolver, onAction, onDrag }: ModelViewerAppProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver} route="model" actions={MODEL_ACTIONS} onAction={onAction}>
      <ModelViewer
        viroTag="mv-model"
        label="Shiba model"
        source={require("../visionos-sweep/assets/shiba.glb")}
        type="GLB"
        position={[0, -0.05, -1.3]}
        scale={[0.2, 0.2, 0.2]}
        resettable={false}
        onDrag={(position) => onDrag?.(position)}
      />
      <SpatialPanel viroTag="mv-panel" position={[0, -0.35, -1.0]} width={0.5} height={0.24}>
        <PanelText
          viroTag="mv-status"
          role="body"
          text="Facing front, size 100 %"
          position={[0, 0.07, 0.005]}
          width={0.44}
          height={0.05}
          maxLines={1}
        />
        {CONTROLS.map((control) => (
          <ViroText
            key={control.tag}
            viroTag={control.tag}
            text={control.text}
            accessibilityLabel={control.label}
            position={[control.x, control.y, 0.005]}
            width={control.width}
            height={0.04}
            style={{ fontSize: CONTROL_PT, fontWeight: "600", color: control.tag === "mv-reset" ? TEXT : ACCENT, textAlign: "center" }}
            specsAction={{ on: "select", actionId: control.actionId, payload: control.payload }}
          />
        ))}
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
