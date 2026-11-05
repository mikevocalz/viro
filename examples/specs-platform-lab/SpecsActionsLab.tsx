import * as React from "react";
import { createStore, useStore, type StoreApi } from "zustand";
// Module paths rather than the package root keep the Jest suite free of
// React Native's Flow sources; an app imports the same names from
// "@reactvision/react-viro".
import { ViroNode } from "../../components/ViroNode";
import { ViroText } from "../../components/ViroText";
import { ViroSpecsScene, type ViroSpecsSceneTransport } from "../../components/Specs/ViroSpecsScene";
import { bindSpecsActionsToStore, type ViroSpecsActionReducers } from "../../components/Specs/ViroSpecsActions";
import { defineSpecsActions, specsTrigger } from "../../components/Specs/core/actions";
import type { ViroSpecsDiagnostic } from "../../components/Specs/core/diagnostic";

/**
 * Typed actions reference flow: select a card, see its details, change a
 * setting, see the view update, go back to the list at the scroll position
 * it was left at.
 *
 * State lives in a Zustand store. A pinch on the Lens fires a trigger, the
 * Lens resolves it to a typed action, the transport delivers it, the
 * reducer updates the store, and the re-render patches or navigates the
 * Lens scene. Nothing in the scene holds a closure.
 *
 * The standalone Lens version is ViroSpecsReferenceFlow in
 * `@viro-external/specs`: same action IDs, payloads and exhibits.
 */
export const SPECS_ACTIONS_LAB_SPEC = {
  "exhibit.open": { payload: { exhibitId: { type: "string" } } },
  "settings.set-units": { payload: { units: { type: "string", enum: ["metric", "imperial"] } } },
  "nav.back": {},
} as const;

export const SPECS_ACTIONS_LAB_ACTIONS = defineSpecsActions(SPECS_ACTIONS_LAB_SPEC);

export type SpecsActionsLabUnits = "metric" | "imperial";

export type SpecsActionsLabExhibit = {
  readonly id: string;
  readonly title: string;
  readonly distanceMeters: number;
};

export type SpecsActionsLabState = {
  readonly route: "list" | "details";
  readonly exhibits: readonly SpecsActionsLabExhibit[];
  /** Card shown on the details route and highlighted on the list. */
  readonly selectedId?: string;
  readonly units: SpecsActionsLabUnits;
};

export const SPECS_ACTIONS_LAB_INITIAL_STATE: SpecsActionsLabState = {
  route: "list",
  units: "metric",
  exhibits: [
    { id: "orrery", title: "Orrery", distanceMeters: 12 },
    { id: "pendulum", title: "Foucault Pendulum", distanceMeters: 40 },
    { id: "tesla-coil", title: "Tesla Coil", distanceMeters: 75 },
    { id: "planetarium", title: "Planetarium", distanceMeters: 120 },
    { id: "wind-tunnel", title: "Wind Tunnel", distanceMeters: 160 },
    { id: "seismograph", title: "Seismograph", distanceMeters: 210 },
    { id: "cloud-chamber", title: "Cloud Chamber", distanceMeters: 260 },
    { id: "lighthouse-lens", title: "Lighthouse Lens", distanceMeters: 330 },
  ],
};

/** Pure reducers, one per action. The Lens registry runs the same logic. */
export const SPECS_ACTIONS_LAB_REDUCERS: ViroSpecsActionReducers<SpecsActionsLabState, typeof SPECS_ACTIONS_LAB_SPEC> = {
  "exhibit.open": (state, { exhibitId }) =>
    state.exhibits.some((e) => e.id === exhibitId) ? { ...state, route: "details", selectedId: exhibitId } : state,
  "settings.set-units": (state, { units }) => (units === state.units ? state : { ...state, units }),
  "nav.back": (state) => (state.route === "list" ? state : { ...state, route: "list" }),
};

/** A store holding the lab's state, for apps and tests. */
export function createSpecsActionsLabStore(
  initial: SpecsActionsLabState = SPECS_ACTIONS_LAB_INITIAL_STATE
): StoreApi<SpecsActionsLabState> {
  return createStore<SpecsActionsLabState>(() => initial);
}

/** Distance label in the chosen units. */
export function formatSpecsActionsLabDistance(meters: number, units: SpecsActionsLabUnits): string {
  return units === "imperial" ? Math.round(meters * 3.28084) + " ft away" : meters + " m away";
}

const ROW_HEIGHT = 0.07;
const LIST_HEIGHT = 0.28;
// The flow sits 1.2-1.26 m away. 1.2 degrees there is 2.5-2.6 cm, and Lens
// text is 0.0227 cm per point, so body text needs at least 117 points
// (VS3018). Titles are one step larger.
const BODY_PT = 120;
const TITLE_PT = 140;
const TEXT = "#f2f2f2";
const ACCENT = "#7aa2ff";

export type SpecsActionsLabProps = {
  transport: ViroSpecsSceneTransport;
  store: StoreApi<SpecsActionsLabState>;
  onDiagnostic?: (diagnostic: ViroSpecsDiagnostic) => void;
};

export function SpecsActionsLab({ transport, store, onDiagnostic }: SpecsActionsLabProps) {
  const state = useStore(store);
  const dispatcher = React.useMemo(
    () =>
      bindSpecsActionsToStore(store, SPECS_ACTIONS_LAB_ACTIONS, SPECS_ACTIONS_LAB_REDUCERS, {
        ...(onDiagnostic ? { onDiagnostic } : {}),
      }),
    [store, onDiagnostic]
  );
  const selected = state.exhibits.find((e) => e.id === state.selectedId);
  const onDetails = state.route === "details" && selected !== undefined;

  return (
    <ViroSpecsScene
      transport={transport}
      route={onDetails ? "details" : "list"}
      actions={dispatcher.declarations}
      onAction={dispatcher.dispatch}
      {...(onDiagnostic ? { onDiagnostic } : {})}
    >
      <ViroNode viroTag="flow-root" position={[0, 0, -1.2]}>
        {onDetails && selected
          ? renderDetails(selected, state.units)
          : renderList(state.exhibits, state.selectedId)}
      </ViroNode>
    </ViroSpecsScene>
  );
}

// The Specs compilers map Viro elements, not user components, so the views
// are functions that return elements rather than components.
function renderList(exhibits: readonly SpecsActionsLabExhibit[], selectedId: string | undefined) {
  return (
    <>
      <ViroText
        viroTag="list-title"
        text="Exhibits"
        position={[0, 0.17, 0.01]}
        width={0.44}
        height={0.05}
        style={{ fontSize: TITLE_PT, fontWeight: "bold", color: TEXT }}
      />
      <ViroNode
        viroTag="exhibit-list"
        position={[0, -0.02, 0.01]}
        specsScroll={{ width: 0.44, height: LIST_HEIGHT, contentHeight: exhibits.length * ROW_HEIGHT }}
      >
        {exhibits.map((exhibit, index) => (
          <ViroText
            key={exhibit.id}
            viroTag={"card-" + exhibit.id}
            text={exhibit.title}
            position={[0, -ROW_HEIGHT * (index + 0.5), 0]}
            width={0.42}
            height={0.05}
            style={{ fontSize: BODY_PT, color: exhibit.id === selectedId ? ACCENT : TEXT, textAlign: "left" }}
            accessibilityLabel={"Open " + exhibit.title}
            specsAction={specsTrigger(SPECS_ACTIONS_LAB_ACTIONS, "exhibit.open", { exhibitId: exhibit.id })}
          />
        ))}
      </ViroNode>
    </>
  );
}

function renderDetails(exhibit: SpecsActionsLabExhibit, units: SpecsActionsLabUnits) {
  const nextUnits: SpecsActionsLabUnits = units === "metric" ? "imperial" : "metric";
  return (
    <>
      <ViroText
        viroTag="details-title"
        text={exhibit.title}
        position={[0, 0.15, 0.01]}
        width={0.44}
        height={0.05}
        style={{ fontSize: TITLE_PT, fontWeight: "bold", color: TEXT }}
      />
      <ViroText
        viroTag="details-distance"
        text={formatSpecsActionsLabDistance(exhibit.distanceMeters, units)}
        position={[0, 0.07, 0.01]}
        width={0.44}
        height={0.04}
        style={{ fontSize: BODY_PT, color: "#d0d0d0" }}
      />
      <ViroText
        viroTag="units-toggle"
        text={nextUnits === "imperial" ? "Show feet" : "Show meters"}
        position={[0, -0.04, 0.01]}
        width={0.3}
        height={0.06}
        style={{ fontSize: BODY_PT, color: ACCENT, textAlign: "center" }}
        accessibilityLabel={nextUnits === "imperial" ? "Show distance in feet" : "Show distance in meters"}
        specsAction={specsTrigger(SPECS_ACTIONS_LAB_ACTIONS, "settings.set-units", { units: nextUnits })}
      />
      <ViroText
        viroTag="back-button"
        text="Back to exhibits"
        position={[0, -0.14, 0.01]}
        width={0.3}
        height={0.06}
        style={{ fontSize: BODY_PT, color: ACCENT, textAlign: "center" }}
        accessibilityLabel="Back to exhibits"
        specsAction={specsTrigger(SPECS_ACTIONS_LAB_ACTIONS, "nav.back", {})}
      />
    </>
  );
}
