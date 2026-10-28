import * as React from "react";
import {
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
 * Reference app 3: an info card placed in the world.
 *
 * The card starts hidden. "Place card" starts a placement: the Lens
 * experience layer casts a WorldQuery hit test from the head, draws the
 * reticle with the surface name, and a pinch confirms. The confirmed pose
 * arrives as the typed action `placement.confirm` with the hit position, and
 * the next render shows the card there, turned to face the wearer. Looking
 * away for 1.5 s cancels on the Lens; "Cancel" leaves placement from app
 * state.
 *
 * WorldQuery on SPECS classifies ground only; walls, tables and seats come
 * from the hit normal and height (see `@viro-external/specs`
 * `doc/Experience.md`). The control panel sits at 0.95 m, below eye line, as
 * in the Platform Lab Placement scene.
 */

export const PLACEMENT_ACTION_SPEC = {
  "placement.start": {},
  "placement.cancel": {},
  "placement.confirm": { payload: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } } },
} as const;

/** The same declarations as the literal list `ViroSpecsScene` takes. */
export const PLACEMENT_ACTIONS = [
  { id: "placement.start" },
  { id: "placement.cancel" },
  { id: "placement.confirm", payload: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } } },
] as const;

export type PlacementPhase = "idle" | "placing" | "placed";

export type PlacementState = {
  readonly phase: PlacementPhase;
  /** Where the card is, in meters, once placed. */
  readonly position?: readonly [number, number, number];
};

export const PLACEMENT_INITIAL_STATE: PlacementState = { phase: "idle" };

export const PLACEMENT_REDUCERS: ViroSpecsActionReducers<PlacementState, typeof PLACEMENT_ACTION_SPEC> = {
  "placement.start": (state) => (state.phase === "placing" ? state : { ...state, phase: "placing" }),
  // Cancel keeps a card that was already placed where it was.
  "placement.cancel": (state) =>
    state.phase !== "placing" ? state : state.position !== undefined ? { ...state, phase: "placed" } : { phase: "idle" },
  "placement.confirm": (state, { x, y, z }) =>
    state.phase !== "placing" ? state : { phase: "placed", position: [x, y, z] },
};

/** Prompt for each phase. */
export const PLACEMENT_PROMPTS = {
  idle: "Pinch Place card, then look at a table or the floor.",
  placing: "Look at a table or the floor, then pinch to place.",
  placed: "Card placed. Pinch Move card to place it again.",
} as const;

const TEXT = "#eef2f0";
const ACCENT = "#f2b544";

// The controls sit about 1.03 m away: 1.2 degrees needs at least 95 points.
const CONTROL_PT = 105;

export type WorldPlacedInfoProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver?: ViroSpecsSourceResolver;
  onAction?: (event: ViroSpecsActionEvent) => void;
};

export function WorldPlacedInfo({ transport, sourceResolver, onAction }: WorldPlacedInfoProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver} route="placement" actions={PLACEMENT_ACTIONS} onAction={onAction}>
      <SpatialPanel viroTag="wpi-card" position={[0, -0.1, -1.2]} width={0.4} height={0.26} visible={false}>
        <PanelText viroTag="wpi-card-title" role="title" text="Monstera" position={[0, 0.07, 0.005]} />
        <PanelText
          viroTag="wpi-card-body"
          role="body"
          text="Water when the top 3 cm of soil is dry. Keep out of direct sun."
          position={[0, -0.045, 0.005]}
          width={0.36}
          height={0.13}
          maxLines={3}
        />
      </SpatialPanel>
      <SpatialPanel viroTag="wpi-controls" position={[0, -0.35, -0.95]} width={0.42} height={0.2}>
        <PanelText
          viroTag="wpi-prompt"
          role="body"
          text={PLACEMENT_PROMPTS.idle}
          position={[0, 0.045, 0.005]}
          width={0.38}
          height={0.07}
          maxLines={2}
        />
        <ViroText
          viroTag="wpi-place"
          text="Place card"
          accessibilityLabel="Place the info card"
          position={[-0.09, -0.05, 0.005]}
          width={0.17}
          height={0.04}
          style={{ fontSize: CONTROL_PT, fontWeight: "600", color: ACCENT, textAlign: "center" }}
          specsAction={{ on: "select", actionId: "placement.start" }}
        />
        <ViroText
          viroTag="wpi-cancel"
          text="Cancel"
          accessibilityLabel="Cancel placement"
          position={[0.11, -0.05, 0.005]}
          width={0.13}
          height={0.04}
          visible={false}
          style={{ fontSize: CONTROL_PT, fontWeight: "600", color: TEXT, textAlign: "center" }}
          specsAction={{ on: "select", actionId: "placement.cancel" }}
        />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
