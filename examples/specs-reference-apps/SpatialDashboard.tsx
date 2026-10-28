import * as React from "react";
import {
  PanelText,
  SpatialPanel,
  ViroNode,
  ViroSpecsScene,
  ViroText,
  type ViroSpecsActionEvent,
  type ViroSpecsActionReducers,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "../../index";

/**
 * Reference app 1: a spatial dashboard.
 *
 * One SpatialPanel 1.5 m ahead holds three metric cards, a range selector
 * (1 h, 24 h, 7 d) and a Refresh control. Every control fires a typed action
 * through `specsAction`; nothing in the scene holds a closure, so the Lens
 * can run the same loop with no phone attached.
 *
 * The JSX is the initial state (range 24 h). A state change is a reducer
 * below plus a re-render on the phone, or the matching Lens view in
 * `@viro-external/specs` `examples/reference-apps/leaf/ViroRefAppsLogic.ts`
 * when the Lens runs standalone. Both use the data in this file.
 */

/** Action declarations, keyed, for `defineSpecsActions` and the reducers. */
export const DASHBOARD_ACTION_SPEC = {
  "dashboard.set-range": { payload: { range: { type: "string", enum: ["1h", "24h", "7d"] } } },
  "dashboard.refresh": {},
} as const;

/**
 * The same declarations as a list, for `ViroSpecsScene`'s `actions` prop. The
 * static compiler reads a literal list, not a `defineSpecsActions(...)` call;
 * the reference-app test checks the two never drift apart.
 */
export const DASHBOARD_ACTIONS = [
  { id: "dashboard.set-range", payload: { range: { type: "string", enum: ["1h", "24h", "7d"] } } },
  { id: "dashboard.refresh" },
] as const;

export type DashboardRange = "1h" | "24h" | "7d";

export type DashboardState = {
  readonly range: DashboardRange;
  /** Refreshes since the dashboard opened. */
  readonly refreshes: number;
};

export const DASHBOARD_INITIAL_STATE: DashboardState = { range: "24h", refreshes: 0 };

/** Pure reducers, one per action. The Lens registry runs the same logic. */
export const DASHBOARD_REDUCERS: ViroSpecsActionReducers<DashboardState, typeof DASHBOARD_ACTION_SPEC> = {
  "dashboard.set-range": (state, { range }) => (range === state.range ? state : { ...state, range }),
  "dashboard.refresh": (state) => ({ ...state, refreshes: state.refreshes + 1 }),
};

/**
 * Sensor readings per range. Sample data: a product would load these. The
 * Lens view in `@viro-external/specs` carries a copy.
 */
export const DASHBOARD_METRICS = [
  { id: "temp", label: "Temperature", x: -0.25, values: { "1h": "21.4 °C", "24h": "20.8 °C", "7d": "20.1 °C" } },
  { id: "humidity", label: "Humidity", x: 0, values: { "1h": "48 %", "24h": "51 %", "7d": "55 %" } },
  { id: "co2", label: "CO2", x: 0.25, values: { "1h": "612 ppm", "24h": "580 ppm", "7d": "540 ppm" } },
] as const;

/** Range controls: visible text, accessible name, and the status line each one selects. */
export const DASHBOARD_RANGES = [
  { id: "1h", text: "1 h", label: "Show the last hour", status: "Averages over the last hour", x: -0.27 },
  { id: "24h", text: "24 h", label: "Show the last 24 hours", status: "Averages over the last 24 hours", x: -0.14 },
  { id: "7d", text: "7 d", label: "Show the last 7 days", status: "Averages over the last 7 days", x: -0.01 },
] as const;

const INITIAL_RANGE = "24h";
const INITIAL_STATUS = "Averages over the last 24 hours";

// Spatial token colors (components/Specs/core/tokens.ts): color.text and
// color.focus. Literals, because the static compiler reads same-file
// constants and relative imports, and these two never change per state.
const TEXT = "#eef2f0";
const ACCENT = "#f2b544";

// The controls sit about 1.52 m away. 1.2 degrees there is a 3.2 cm em, and
// Lens text is 4388.6 points per meter of em, so control text needs at
// least 140 points (VS3018).
const CONTROL_PT = 150;

export type SpatialDashboardProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver?: ViroSpecsSourceResolver;
  /** Receives every typed action, usually `dispatcher.dispatch` from `bindSpecsActionsToStore`. */
  onAction?: (event: ViroSpecsActionEvent) => void;
};

export function SpatialDashboard({ transport, sourceResolver, onAction }: SpatialDashboardProps) {
  return (
    <ViroSpecsScene
      transport={transport}
      sourceResolver={sourceResolver}
      route="dashboard"
      actions={DASHBOARD_ACTIONS}
      onAction={onAction}
    >
      <SpatialPanel viroTag="dash-panel" position={[0, 0, -1.5]} width={0.8} height={0.52}>
        <PanelText viroTag="dash-title" role="title" text="Workshop sensors" position={[0, 0.2, 0.005]} />
        {DASHBOARD_METRICS.map((metric) => (
          <ViroNode key={metric.id} viroTag={"dash-card-" + metric.id} position={[metric.x, 0, 0.005]}>
            <PanelText
              viroTag={"dash-card-" + metric.id + "-label"}
              role="label"
              tone="muted"
              text={metric.label}
              position={[0, 0.1, 0]}
            />
            <PanelText
              viroTag={"dash-card-" + metric.id + "-value"}
              role="title"
              text={metric.values[INITIAL_RANGE]}
              position={[0, 0.03, 0]}
            />
          </ViroNode>
        ))}
        {DASHBOARD_RANGES.map((range) => (
          <ViroText
            key={range.id}
            viroTag={"dash-range-" + range.id}
            text={range.text}
            accessibilityLabel={range.label}
            position={[range.x, -0.08, 0.005]}
            width={0.11}
            height={0.05}
            style={{ fontSize: CONTROL_PT, fontWeight: "600", color: range.id === INITIAL_RANGE ? ACCENT : TEXT, textAlign: "center" }}
            specsAction={{ on: "select", actionId: "dashboard.set-range", payload: { range: range.id } }}
          />
        ))}
        <ViroText
          viroTag="dash-refresh"
          text="Refresh"
          accessibilityLabel="Refresh readings"
          position={[0.24, -0.08, 0.005]}
          width={0.2}
          height={0.05}
          style={{ fontSize: CONTROL_PT, fontWeight: "600", color: ACCENT, textAlign: "center" }}
          specsAction={{ on: "select", actionId: "dashboard.refresh" }}
        />
        <PanelText
          viroTag="dash-status"
          role="body"
          tone="muted"
          text={INITIAL_STATUS}
          position={[0, -0.18, 0.005]}
          width={0.7}
          height={0.06}
          maxLines={1}
        />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
