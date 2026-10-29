import type {
  ViroSpecsButtonAuthoredState,
  ViroSpecsManifestNode,
  ViroSpecsManifestV2,
  ViroSpecsTextRole,
} from "../../../../components/Specs/core/manifest";
import {
  VIRO_SPECS_LENS_SPATIAL_TOKENS,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  viroSpecsAngleToMeters,
} from "../vendor/lens-core/ViroSpecsExperienceTokens";

/**
 * Manifest v2 scenes for the premium component stories. Shapes follow the
 * compiled fixtures in __test__/fixtures/specs/gallery (navigation,
 * interaction) and reference-apps/model-viewer: panels at the default
 * 1.5 m, PanelText sizes from the role angle at that distance.
 */

export const SHIBA = "examples/visionos-sweep/assets/shiba.glb";
export const BUTTON = "examples/visionos-sweep/assets/button.png";
export const MISSING_IMAGE = "assets/not-there.png";
export const MISSING_MODEL = "assets/not-there.glb";
const DISTANCE = VIRO_SPECS_LENS_SPATIAL_TOKENS.distance.defaultMeters;
const TEXT = VIRO_SPECS_LENS_SPATIAL_TOKENS.color.text;
const MUTED = VIRO_SPECS_LENS_SPATIAL_TOKENS.color.textMuted;
const BUTTON_HEIGHT = 0.084;

type Node = ViroSpecsManifestNode;
type Interaction = ViroSpecsManifestV2["interactions"][number];

/** Lens Text size whose em is the role's angle at `distance` (the compiler's PanelText sizing). */
export function textSize(role: ViroSpecsTextRole, distance = DISTANCE): number {
  const t = VIRO_SPECS_LENS_SPATIAL_TOKENS.type;
  const deg = role === "title" ? t.titleDeg : role === "body" ? t.bodyDeg : t.labelDeg;
  return Math.ceil((viroSpecsAngleToMeters(deg, distance) / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
}

function scene(nodes: Node[], interactions: Interaction[] = []): ViroSpecsManifestV2 {
  return { version: 2, generator: { name: "hand-written" }, nodes, polylines: [], lights: [], materials: [], interactions, animations: [] };
}

function panel(id: string, width: number, height: number, y = 0, title?: string): Node {
  return {
    id,
    kind: "panel",
    position: [0, y, -DISTANCE],
    extents: { width, height },
    component: title === undefined ? { type: "spatial-panel" } : { type: "spatial-panel", title },
  };
}

/** Height of one line of a role's text at `distance`, meters. */
function lineHeight(role: ViroSpecsTextRole, distance = DISTANCE): number {
  const t = VIRO_SPECS_LENS_SPATIAL_TOKENS.type;
  const deg = role === "title" ? t.titleDeg : role === "body" ? t.bodyDeg : t.labelDeg;
  return viroSpecsAngleToMeters(deg, distance) * t.lineHeight;
}

function panelText(id: string, parentId: string, text: string, role: ViroSpecsTextRole, tone: "default" | "muted", y: number, width = 0.46, lines = 1): Node {
  return {
    id,
    kind: "text",
    parentId,
    position: [0, y, 0.005],
    text,
    style: { fontSize: textSize(role), fontWeight: role === "title" ? "600" : "400", color: tone === "muted" ? MUTED : TEXT },
    // Tall enough for `lines` lines, so the Lens text box does not cut the last one.
    extents: { width, height: lines * lineHeight(role) + 0.01 },
    maxLines: lines,
    component: { type: "panel-text", role, tone },
  };
}

function button(id: string, parentId: string, label: string, state: ViroSpecsButtonAuthoredState, x: number, y: number, errorMessage?: string): Node {
  return {
    id,
    kind: "panel",
    label,
    parentId,
    position: [x, y, 0.005],
    extents: { width: 0.23, height: BUTTON_HEIGHT },
    component: errorMessage === undefined ? { type: "panel-button", state } : { type: "panel-button", state, errorMessage },
  };
}

const pressable = (nodeId: string): Interaction => ({ nodeId, interactable: true, manipulation: false, events: ["hover", "select"] });

/** SpatialPanel with a title, body copy and one action. */
export function spatialPanelScene(): ViroSpecsManifestV2 {
  return scene(
    [
      panel("sp-panel", 0.5, 0.36, 0, "Room scan"),
      panelText("sp-body", "sp-panel", "Walk slowly along the walls of the room.", "body", "default", 0.055, 0.46, 2),
      panelText("sp-hint", "sp-panel", "About 30 seconds", "label", "muted", -0.03),
      button("sp-start", "sp-panel", "Start scan", "idle", 0, -0.115),
    ],
    [pressable("sp-start")]
  );
}

/** PanelText in each role and tone. */
export function panelTextScene(): ViroSpecsManifestV2 {
  return scene([
    panel("pt-panel", 0.52, 0.34),
    panelText("pt-title", "pt-panel", "Title, 2.0 degrees", "title", "default", 0.11),
    panelText("pt-body", "pt-panel", "Body, 1.4 degrees, default tone", "body", "default", 0.035),
    panelText("pt-body-muted", "pt-panel", "Body, muted tone", "body", "muted", -0.03),
    panelText("pt-label", "pt-panel", "Label, 1.2 degrees, the minimum", "label", "default", -0.09),
  ]);
}

/** One PanelButton in an authored state, inside a SpatialPanel. */
export function panelButtonScene(state: ViroSpecsButtonAuthoredState, label = "Save changes"): ViroSpecsManifestV2 {
  const errorMessage = state === "error" ? "Not saved. Pinch Save changes to try again." : undefined;
  return scene([panel("pb-panel", 0.36, 0.2), button("pb-button", "pb-panel", label, state, 0, 0.02, errorMessage)], [pressable("pb-button")]);
}

/**
 * Every PanelButton visual state at once: the five authored states, plus
 * hover and pressed, which the host derives from input (the stories replay
 * hover-enter and select-start on two idle buttons).
 */
export function panelButtonStatesScene(): ViroSpecsManifestV2 {
  const rows: [string, string, ViroSpecsButtonAuthoredState, number, number][] = [
    ["pbs-idle", "Idle", "idle", -0.125, 0.15],
    ["pbs-hover", "Hover", "idle", 0.125, 0.15],
    ["pbs-pressed", "Pressed", "idle", -0.125, 0.05],
    ["pbs-selected", "Selected", "selected", 0.125, 0.05],
    ["pbs-disabled", "Disabled", "disabled", -0.125, -0.05],
    ["pbs-loading", "Loading", "loading", 0.125, -0.05],
    ["pbs-error", "Retry upload", "error", 0, -0.15],
  ];
  return scene(
    [
      panel("pbs-panel", 0.53, 0.46),
      ...rows.map(([id, label, state, x, y]) => button(id, "pbs-panel", label, state, x, y, state === "error" ? "Upload failed." : undefined)),
    ],
    rows.map(([id]) => pressable(id))
  );
}

/** PanelImage: one loaded image, one whose source the registry cannot resolve. */
export function panelImageScene(): ViroSpecsManifestV2 {
  return scene([
    panel("pi-panel", 0.46, 0.26),
    { id: "pi-loaded", kind: "image", parentId: "pi-panel", position: [-0.1, 0.02, 0.005], extents: { width: 0.14, height: 0.14 }, source: BUTTON, component: { type: "panel-image" } },
    { id: "pi-missing", kind: "image", parentId: "pi-panel", position: [0.1, 0.02, 0.005], extents: { width: 0.14, height: 0.14 }, source: MISSING_IMAGE, component: { type: "panel-image" } },
    panelText("pi-caption", "pi-panel", "Loaded, and missing (placeholder)", "label", "muted", -0.09),
  ]);
}

/** SpatialScrollView: eight cards in a two-row window, the navigation fixture's layout. */
export function scrollViewScene(): ViroSpecsManifestV2 {
  const cards: Node[] = [];
  const interactions: Interaction[] = [];
  for (let i = 0; i < 8; i++) {
    const id = "sv-card-" + (i + 1);
    cards.push(button(id, "sv-list", "Card " + (i + 1), "idle", i % 2 === 0 ? -0.12 : 0.12, -0.065 - Math.floor(i / 2) * 0.13));
    cards.push({ id: id + "-image", kind: "image", parentId: id, position: [-0.085, 0, 0.012], extents: { width: 0.04, height: 0.04 }, source: BUTTON, component: { type: "panel-image" } });
    interactions.push(pressable(id));
  }
  return scene(
    [
      panel("sv-panel", 0.53, 0.38),
      panelText("sv-title", "sv-panel", "Rooms", "title", "default", 0.145),
      {
        id: "sv-list",
        kind: "group",
        parentId: "sv-panel",
        position: [0, -0.025, 0.005],
        scroll: { width: 0.48, height: 0.26, contentHeight: 0.52 },
        component: { type: "scroll-view", itemHeightMeters: 0.13, initialIndex: 0 },
      },
      ...cards,
    ],
    interactions
  );
}

/** ModelViewer on a GLB, with a status line, as in reference-apps/model-viewer. */
export function modelViewerScene(source = SHIBA): ViroSpecsManifestV2 {
  return scene(
    [
      {
        id: "mv-model",
        kind: "model",
        label: "Shiba model",
        position: [0, 0.02, -1.3],
        scale: [0.2, 0.2, 0.2],
        rotation: [0, Math.sin((-25 * Math.PI) / 360), 0, Math.cos((-25 * Math.PI) / 360)],
        source,
        format: "glb",
        component: { type: "model-viewer", autoRotate: false, resettable: false },
      },
      panel("mv-panel", 0.5, 0.12, -0.3),
      panelText("mv-status", "mv-panel", "Facing front, size 100 %", "body", "default", 0, 0.44),
    ],
    [{ nodeId: "mv-model", interactable: true, manipulation: true, events: ["drag"] }]
  );
}

/**
 * A scene the Lens host rejects: a node whose parent does not exist. The
 * manifest validator fails it, so it reaches the controller unchanged and the
 * controller's own validation rejects it (the preview's "Invalid: missing
 * parent" fixture does the same).
 */
export function rejectedScene(): unknown {
  return {
    version: 2,
    generator: { name: "hand-written" },
    nodes: [{ id: "orphan", kind: "text", parentId: "nowhere", text: "No parent" }],
    polylines: [],
    lights: [],
    materials: [],
    interactions: [],
    animations: [],
  };
}

/** SpatialPanel, PanelText and PanelButton states together: the high-contrast comparison scene. */
export function contrastScene(): ViroSpecsManifestV2 {
  return scene(
    [
      panel("hc-panel", 0.53, 0.4, 0, "Display"),
      panelText("hc-body", "hc-panel", "Text stays readable over a bright room.", "body", "default", 0.065, 0.46, 2),
      panelText("hc-muted", "hc-panel", "Muted copy turns white", "label", "muted", -0.02),
      button("hc-idle", "hc-panel", "Apply", "idle", -0.125, -0.1),
      button("hc-selected", "hc-panel", "Selected", "selected", 0.125, -0.1),
    ],
    [pressable("hc-idle"), pressable("hc-selected")]
  );
}
