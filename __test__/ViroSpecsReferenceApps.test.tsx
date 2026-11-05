import * as fs from "node:fs";
import * as path from "node:path";

// The package index loads Flow-typed React Native internals Jest cannot parse
// here; the reference apps import from it, so swap in the Specs stand-in.
jest.mock("../index", () => require("./fixtures/specs/compiler/viro"));

import { checkSpecsActionDeclaration, checkSpecsActionPayload, defineSpecsActions, type ViroSpecsActionDeclaration } from "../components/Specs/core/actions";
import { bindSpecsActionsToStore, resolveSpecsTriggers } from "../components/Specs/ViroSpecsActions";
import { compileViroSpecsChildren } from "../components/Specs/ViroSpecsCompiler";
import type { ViroSpecsDiagnostic } from "../components/Specs/core/diagnostic";
import type { ViroSpecsManifestV2 } from "../components/Specs/core/manifest";
import { serializeSpecsManifest, serializeSpecsSceneDocument, specsManifestSharedSubset } from "../components/Specs/core/serialize";
import { validateSpecsManifestV2 } from "../components/Specs/core/validate";
import { compileSpecsEntry } from "../src/specs-cli/compile";
import { renderSpecsLensHost } from "../src/specs-cli/lensTs";
import {
  DASHBOARD_ACTIONS,
  DASHBOARD_ACTION_SPEC,
  DASHBOARD_INITIAL_STATE,
  DASHBOARD_METRICS,
  DASHBOARD_RANGES,
  DASHBOARD_REDUCERS,
  SpatialDashboard,
  type DashboardState,
} from "../examples/specs-reference-apps/SpatialDashboard";
import {
  MODEL_ACTIONS,
  MODEL_ACTION_SPEC,
  MODEL_INITIAL_STATE,
  MODEL_REDUCERS,
  ModelViewerApp,
  modelStatusLine,
  type ModelViewerState,
} from "../examples/specs-reference-apps/ModelViewer";
import {
  PLACEMENT_ACTIONS,
  PLACEMENT_ACTION_SPEC,
  PLACEMENT_INITIAL_STATE,
  PLACEMENT_PROMPTS,
  PLACEMENT_REDUCERS,
  WorldPlacedInfo,
  type PlacementState,
} from "../examples/specs-reference-apps/WorldPlacedInfo";

/**
 * The three reference apps: each compiles clean in both compilers (no
 * comfort, label, prop or strict-mode findings), both manifests match byte
 * for byte, and the outputs match the goldens under
 * `__test__/fixtures/specs/reference-apps/<app>/`:
 *
 * - `manifest.json`: manifest v2 from viro-specs-compile
 * - `scene.json`: the scene protocol 2 document (`--format scene-json`),
 *   copied byte for byte to `@viro-external/specs`
 *   `examples/reference-apps/scenes/`
 * - `host.lens.ts`: the generated Lens host (`--format lens-ts`)
 * - `diagnostics.txt`: empty
 *
 * Regenerate with:
 *   UPDATE_SPECS_GOLDENS=1 npm run test:specs -- ViroSpecsReferenceApps
 */
const repo = path.join(__dirname, "..");
const goldenDir = path.join(__dirname, "fixtures", "specs", "reference-apps");
const update = process.env.UPDATE_SPECS_GOLDENS === "1";

type SceneElement = { props: { children?: unknown; route?: string; actions?: readonly ViroSpecsActionDeclaration[] } };
type AppProps = { transport: { applyScene(): void }; sourceResolver: (value: unknown) => string };
const props: AppProps = {
  transport: { applyScene() {} },
  sourceResolver: (value) => (value as { uri: string }).uri,
};

const APPS = [
  { name: "dashboard", file: "SpatialDashboard.tsx", route: "dashboard", render: (p: AppProps) => SpatialDashboard(p) },
  { name: "model-viewer", file: "ModelViewer.tsx", route: "model", render: (p: AppProps) => ModelViewerApp(p) },
  { name: "world-placed-info", file: "WorldPlacedInfo.tsx", route: "placement", render: (p: AppProps) => WorldPlacedInfo(p) },
] as const;

function describeAll(diagnostics: readonly ViroSpecsDiagnostic[]): string[] {
  return diagnostics.map((d) => d.severity + " " + d.code + " [" + (d.nodeId ?? "") + "] " + d.message);
}

function golden(file: string, actual: string): void {
  if (update || !fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, actual);
    if (!update) throw new Error("Golden " + path.relative(repo, file) + " was missing and has been written. Review it and rerun.");
    return;
  }
  expect(actual).toBe(fs.readFileSync(file, "utf8"));
}

function staticCompile(file: string) {
  const entry = path.join(repo, "examples", "specs-reference-apps", file);
  return compileSpecsEntry(fs.readFileSync(entry, "utf8"), entry, { cwd: repo });
}

function runtimeCompile(render: (p: AppProps) => unknown) {
  const element = render(props) as SceneElement;
  // ViroSpecsScene passes its route and actions props the same way.
  const { route, actions } = element.props;
  return compileViroSpecsChildren(element.props.children as Parameters<typeof compileViroSpecsChildren>[0], props.sourceResolver, {
    ...(route !== undefined ? { route } : {}),
    ...(actions !== undefined ? { actions } : {}),
  });
}

function manifestOf(file: string): ViroSpecsManifestV2 {
  const result = staticCompile(file);
  if (result.manifest === undefined) throw new Error(file + " did not compile");
  return result.manifest as ViroSpecsManifestV2;
}

describe.each(APPS)("reference app $name", ({ name, file, route, render }) => {
  it("compiles statically with no diagnostics (what --strict requires)", () => {
    const result = staticCompile(file);
    expect(describeAll(result.diagnostics)).toEqual([]);
    expect(result.manifest).toBeDefined();
  });

  it("compiles at runtime with no diagnostics", () => {
    expect(describeAll(runtimeCompile(render).diagnostics)).toEqual([]);
  });

  it("produces byte-identical manifests in both paths", () => {
    const runtimeBytes = serializeSpecsManifest(specsManifestSharedSubset(runtimeCompile(render).manifest));
    const staticBytes = serializeSpecsManifest(specsManifestSharedSubset(manifestOf(file)));
    expect(runtimeBytes).toBe(staticBytes);
  });

  it("validates, names its route, labels every interactable and fires only declared actions", () => {
    const manifest = manifestOf(file);
    expect(validateSpecsManifestV2(manifest).ok).toBe(true);
    expect(manifest.route).toBe(route);
    expect(manifest.theme?.version).toBe(1);
    const byId = new Map(manifest.nodes.map((node) => [node.id, node]));
    const declared = new Map((manifest.actions ?? []).map((action) => [action.id, action]));
    for (const interaction of manifest.interactions) {
      expect([interaction.nodeId, byId.get(interaction.nodeId)?.label]).toEqual([interaction.nodeId, expect.any(String)]);
      for (const trigger of interaction.triggers ?? []) {
        const declaration = declared.get(trigger.actionId);
        expect([interaction.nodeId, trigger.actionId, declaration !== undefined]).toEqual([interaction.nodeId, trigger.actionId, true]);
        expect(checkSpecsActionPayload(declaration as ViroSpecsActionDeclaration, trigger.payload ?? {})).toEqual([]);
      }
    }
  });

  it("matches the checked-in manifest, scene document, Lens host and (empty) diagnostics", () => {
    const result = staticCompile(file);
    const manifest = result.manifest as ViroSpecsManifestV2;
    const dir = path.join(goldenDir, name);
    golden(path.join(dir, "manifest.json"), serializeSpecsManifest(manifest));
    golden(path.join(dir, "scene.json"), serializeSpecsSceneDocument(manifest));
    golden(path.join(dir, "host.lens.ts"), renderSpecsLensHost({ manifest }));
    golden(path.join(dir, "diagnostics.txt"), result.diagnostics.map((d) => d.code + " " + d.message).join("\n"));
  });
});

describe("reference app actions", () => {
  it("keeps each literal action list equal to its keyed spec", () => {
    expect(defineSpecsActions(DASHBOARD_ACTION_SPEC).declarations).toEqual(DASHBOARD_ACTIONS);
    expect(defineSpecsActions(MODEL_ACTION_SPEC).declarations).toEqual(MODEL_ACTIONS);
    expect(defineSpecsActions(PLACEMENT_ACTION_SPEC).declarations).toEqual(PLACEMENT_ACTIONS);
    for (const declaration of [...DASHBOARD_ACTIONS, ...MODEL_ACTIONS, ...PLACEMENT_ACTIONS]) {
      expect([declaration.id, checkSpecsActionDeclaration(declaration)]).toEqual([declaration.id, []]);
    }
  });

  /** A pinch on `nodeId`, resolved against the compiled manifest and run through the reducers. */
  function pinch<S>(manifest: ViroSpecsManifestV2, dispatch: (event: ReturnType<typeof resolveSpecsTriggers>[number]) => boolean, nodeId: string): void {
    const events = resolveSpecsTriggers(manifest, nodeId, "select-end");
    expect(events.length).toBe(1);
    for (const event of events) expect(dispatch(event)).toBe(true);
  }

  function store<S>(initial: S) {
    let state = initial;
    return { getState: () => state, setState: (next: S) => void (state = next) };
  }

  it("dashboard: a range pinch changes the range, the same range again changes nothing, Refresh counts", () => {
    const manifest = manifestOf("SpatialDashboard.tsx");
    const s = store<DashboardState>(DASHBOARD_INITIAL_STATE);
    const dispatcher = bindSpecsActionsToStore(s, defineSpecsActions(DASHBOARD_ACTION_SPEC), DASHBOARD_REDUCERS);
    pinch(manifest, dispatcher.dispatch, "dash-range-7d");
    expect(s.getState()).toEqual({ range: "7d", refreshes: 0 });
    const before = s.getState();
    pinch(manifest, dispatcher.dispatch, "dash-range-7d");
    expect(s.getState()).toBe(before);
    pinch(manifest, dispatcher.dispatch, "dash-refresh");
    pinch(manifest, dispatcher.dispatch, "dash-refresh");
    expect(s.getState().refreshes - before.refreshes).toBe(2);
  });

  it("dashboard: the compiled scene shows the initial range and its readings", () => {
    const manifest = manifestOf("SpatialDashboard.tsx");
    const text = (id: string) => {
      const node = manifest.nodes.find((n) => n.id === id);
      return node?.kind === "text" ? node.text : undefined;
    };
    const range = DASHBOARD_INITIAL_STATE.range;
    for (const metric of DASHBOARD_METRICS) expect(text("dash-card-" + metric.id + "-value")).toBe(metric.values[range]);
    expect(text("dash-status")).toBe(DASHBOARD_RANGES.find((r) => r.id === range)?.status);
  });

  it("model viewer: turns wrap at 360, resize clamps to its steps, reset returns the authored state", () => {
    const manifest = manifestOf("ModelViewer.tsx");
    const s = store<ModelViewerState>(MODEL_INITIAL_STATE);
    const dispatcher = bindSpecsActionsToStore(s, defineSpecsActions(MODEL_ACTION_SPEC), MODEL_REDUCERS);
    pinch(manifest, dispatcher.dispatch, "mv-turn-left");
    expect(s.getState().yawDegrees).toBe(315);
    pinch(manifest, dispatcher.dispatch, "mv-turn-right");
    pinch(manifest, dispatcher.dispatch, "mv-turn-right");
    expect(s.getState().yawDegrees).toBe(45);
    for (let i = 0; i < 6; i++) pinch(manifest, dispatcher.dispatch, "mv-larger");
    expect(s.getState().sizeStep).toBe(3);
    expect(modelStatusLine(s.getState())).toBe("Turned 45°, size 160 %");
    pinch(manifest, dispatcher.dispatch, "mv-reset");
    expect(s.getState()).toBe(MODEL_INITIAL_STATE);
    const text = manifest.nodes.find((n) => n.id === "mv-status");
    expect(text?.kind === "text" ? text.text : undefined).toBe(modelStatusLine(MODEL_INITIAL_STATE));
  });

  it("world-placed info: start, confirm with a pose, move again and cancel keeps the placed card", () => {
    const manifest = manifestOf("WorldPlacedInfo.tsx");
    const s = store<PlacementState>(PLACEMENT_INITIAL_STATE);
    const dispatcher = bindSpecsActionsToStore(s, defineSpecsActions(PLACEMENT_ACTION_SPEC), PLACEMENT_REDUCERS);
    // A confirm outside placement is ignored.
    expect(dispatcher.dispatch({ actionId: "placement.confirm", payload: { x: 0, y: -0.5, z: -1.2 } })).toBe(true);
    expect(s.getState()).toBe(PLACEMENT_INITIAL_STATE);
    pinch(manifest, dispatcher.dispatch, "wpi-place");
    expect(s.getState().phase).toBe("placing");
    // Cancel before any placement goes back to idle.
    expect(dispatcher.dispatch({ actionId: "placement.cancel", payload: {}, nodeId: "wpi-cancel", on: "select" })).toBe(true);
    expect(s.getState()).toEqual({ phase: "idle" });
    pinch(manifest, dispatcher.dispatch, "wpi-place");
    expect(dispatcher.dispatch({ actionId: "placement.confirm", payload: { x: 0.1, y: -0.5, z: -1.2 } })).toBe(true);
    expect(s.getState()).toEqual({ phase: "placed", position: [0.1, -0.5, -1.2] });
    pinch(manifest, dispatcher.dispatch, "wpi-place");
    expect(dispatcher.dispatch({ actionId: "placement.cancel", payload: {} })).toBe(true);
    expect(s.getState()).toEqual({ phase: "placed", position: [0.1, -0.5, -1.2] });
    // An ill-typed confirm is dropped (VS1018) and changes nothing.
    const seen: string[] = [];
    const strict = bindSpecsActionsToStore(s, defineSpecsActions(PLACEMENT_ACTION_SPEC), PLACEMENT_REDUCERS, { onDiagnostic: (d) => seen.push(d.code) });
    expect(strict.dispatch({ actionId: "placement.confirm", payload: { x: "near", y: -0.5, z: -1.2 } })).toBe(false);
    expect(seen).toEqual(["VS1018"]);
    const prompt = manifest.nodes.find((n) => n.id === "wpi-prompt");
    expect(prompt?.kind === "text" ? prompt.text : undefined).toBe(PLACEMENT_PROMPTS.idle);
    const card = manifest.nodes.find((n) => n.id === "wpi-card");
    expect(card?.visible).toBe(false);
  });
});

/**
 * Layout check on the compiled manifests, the same estimate the gallery test
 * uses: panel, image and text boxes with extents are exact; PanelText without
 * extents is estimated at 0.55 em per character.
 */
describe.each(APPS)("reference app layout $name", ({ file }) => {
  const EM_PER_POINT = 0.01 / 43.886;
  type Box = { id: string; left: number; right: number; bottom: number; top: number; hidden: boolean; panel: string | undefined };

  function boxes() {
    const m = manifestOf(file);
    const byId = new Map(m.nodes.map((n) => [n.id, n]));
    const chain = (id: string) => {
      const out = [];
      for (let n = byId.get(id); n; n = n.parentId !== undefined ? byId.get(n.parentId) : undefined) out.push(n);
      return out;
    };
    const out: Box[] = [];
    for (const n of m.nodes) {
      const ancestors = chain(n.id);
      const panel = ancestors.slice(1).find((a) => a.component?.type === "spatial-panel")?.id;
      const hidden = ancestors.some((a) => a.visible === false);
      let x = 0;
      let y = 0;
      for (const a of ancestors) {
        expect([a.id, a.rotation]).toEqual([a.id, undefined]);
        x += a.position?.[0] ?? 0;
        y += a.position?.[1] ?? 0;
      }
      let width: number | undefined;
      let height: number | undefined;
      if ((n.kind === "panel" || n.kind === "image" || n.kind === "text") && n.extents) {
        width = n.extents.width;
        height = n.extents.height;
      } else if (n.kind === "text") {
        const em = (n.style?.fontSize ?? 0) * EM_PER_POINT;
        width = n.text.length * 0.55 * em;
        height = 1.3 * em;
      }
      if (width === undefined || height === undefined || n.component?.type === "spatial-panel") continue;
      out.push({ id: n.id, left: x - width / 2, right: x + width / 2, bottom: y - height / 2, top: y + height / 2, hidden, panel });
    }
    return { m, out, chain };
  }

  it("keeps every text and control inside its SpatialPanel", () => {
    const { m, out } = boxes();
    const outside: string[] = [];
    for (const b of out) {
      if (b.panel === undefined) continue;
      const panel = m.nodes.find((n) => n.id === b.panel);
      if (!panel || panel.kind !== "panel") continue;
      const [px, py] = [panel.position?.[0] ?? 0, panel.position?.[1] ?? 0];
      const e = panel.extents;
      if (b.left < px - e.width / 2 || b.right > px + e.width / 2 || b.bottom < py - e.height / 2 || b.top > py + e.height / 2) outside.push(b.id);
    }
    expect(outside).toEqual([]);
  });

  // Same frame as the gallery test: Lens Studio 5.24 SPECS 27 Preview at the
  // default pose spans about 6.7 degrees above the horizon to 30.7 below,
  // with the LEAF run banner in the top 2 degrees, so panels stay under
  // 4 degrees up and above 28 down.
  it("fits the SPECS Preview frame at the default pose", () => {
    const { m, chain } = boxes();
    const off: string[] = [];
    for (const n of m.nodes) {
      if (n.kind !== "panel" || n.component?.type !== "spatial-panel") continue;
      const y = chain(n.id).reduce((sum, a) => sum + (a.position?.[1] ?? 0), 0);
      const z = Math.abs(chain(n.id).reduce((sum, a) => sum + (a.position?.[2] ?? 0), 0));
      const deg = (h: number) => (Math.atan2(h, z) * 180) / Math.PI;
      const top = deg(y + n.extents.height / 2);
      const bottom = deg(y - n.extents.height / 2);
      if (top > 4 || bottom < -28) off.push(n.id + " spans " + bottom.toFixed(1) + " to " + top.toFixed(1) + " degrees");
    }
    expect(off).toEqual([]);
  });

  it("never overlaps two boxes that show at the same time in the same panel", () => {
    const { out } = boxes();
    const overlaps: string[] = [];
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (a.panel !== b.panel || a.hidden || b.hidden) continue;
        if (a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top) overlaps.push(a.id + " / " + b.id);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it("gives text with extents room for its lines at the estimated width", () => {
    const { m } = boxes();
    const tooLong: string[] = [];
    for (const n of m.nodes) {
      if (n.kind !== "text" || !n.extents) continue;
      const em = (n.style?.fontSize ?? 0) * EM_PER_POINT;
      const lines = Math.ceil((n.text.length * 0.55 * em) / n.extents.width);
      if (lines > (n.maxLines ?? 1) || lines * 1.3 * em > n.extents.height + 1e-9) tooLong.push(n.id + " needs " + lines + " lines");
    }
    expect(tooLong).toEqual([]);
  });
});
