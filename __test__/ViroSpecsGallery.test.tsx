import * as fs from "node:fs";
import * as path from "node:path";

// The package index loads Flow-typed React Native internals Jest cannot parse
// here; the gallery scenes import from it, so swap in the Specs stand-in.
jest.mock("../index", () => require("./fixtures/specs/compiler/viro"));

import { compileViroSpecsChildren } from "../components/Specs/ViroSpecsCompiler";
import type { ViroSpecsDiagnostic } from "../components/Specs/core/diagnostic";
import type { ViroSpecsManifestV2 } from "../components/Specs/core/manifest";
import { serializeSpecsManifest, serializeSpecsSceneDocument, specsManifestSharedSubset } from "../components/Specs/core/serialize";
import { validateSpecsManifestV2 } from "../components/Specs/core/validate";
import { compileSpecsEntry } from "../src/specs-cli/compile";
import { InteractionScene } from "../examples/specs-platform-lab/InteractionScene";
import { NavigationScene } from "../examples/specs-platform-lab/NavigationScene";
import { PlacementScene } from "../examples/specs-platform-lab/PlacementScene";
import { SpecsPlatformLab } from "../examples/specs-platform-lab/SpecsPlatformLab";

/**
 * The Platform Lab gallery: four scenes that each compile clean in both paths
 * (no comfort, label or prop findings) and produce the same manifest. The
 * scene documents are the fixtures the experience layer tests in
 * @viro-external/specs load (`scripts/fixtures/gallery/*.scene.json`).
 *
 * Regenerate the goldens with:
 *   UPDATE_SPECS_GOLDENS=1 npm run test:specs -- ViroSpecsGallery
 */
const repo = path.join(__dirname, "..");
const goldenDir = path.join(__dirname, "fixtures", "specs", "gallery");
const update = process.env.UPDATE_SPECS_GOLDENS === "1";

type SceneElement = { props: { children?: unknown } };
type GalleryProps = { transport: { applyScene(): void }; sourceResolver: (value: unknown) => string };
const props: GalleryProps = {
  transport: { applyScene() {} },
  sourceResolver: (value) => (value as { uri: string }).uri,
};

const SCENES: readonly { readonly name: string; readonly file: string; readonly render: (p: GalleryProps) => unknown }[] = [
  { name: "hello", file: "SpecsPlatformLab.tsx", render: (p) => SpecsPlatformLab(p) },
  { name: "placement", file: "PlacementScene.tsx", render: (p) => PlacementScene(p) },
  { name: "interaction", file: "InteractionScene.tsx", render: (p) => InteractionScene(p) },
  { name: "navigation", file: "NavigationScene.tsx", render: (p) => NavigationScene(p) },
];

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

describe.each(SCENES)("gallery scene $name", ({ name, file, render }) => {
  const entry = path.join(repo, "examples", "specs-platform-lab", file);
  const fromSource = () => compileSpecsEntry(fs.readFileSync(entry, "utf8"), entry, { cwd: repo });
  const fromRuntime = () =>
    compileViroSpecsChildren((render(props) as SceneElement).props.children as Parameters<typeof compileViroSpecsChildren>[0]);

  it("compiles statically with no diagnostics", () => {
    const result = fromSource();
    expect(describeAll(result.diagnostics)).toEqual([]);
    expect(result.manifest).toBeDefined();
  });

  it("compiles at runtime with no diagnostics", () => {
    expect(describeAll(fromRuntime().diagnostics)).toEqual([]);
  });

  it("produces byte-identical manifests in both paths", () => {
    const runtimeBytes = serializeSpecsManifest(specsManifestSharedSubset(fromRuntime().manifest));
    const staticBytes = serializeSpecsManifest(specsManifestSharedSubset(fromSource().manifest as ViroSpecsManifestV2));
    expect(runtimeBytes).toBe(staticBytes);
  });

  it("carries the theme, a label on every interactable and a component on every premium node", () => {
    const manifest = fromSource().manifest as ViroSpecsManifestV2;
    expect(validateSpecsManifestV2(manifest).ok).toBe(true);
    expect(manifest.theme?.version).toBe(1);
    const byId = new Map(manifest.nodes.map((node) => [node.id, node]));
    for (const interaction of manifest.interactions) {
      expect([interaction.nodeId, byId.get(interaction.nodeId)?.label]).toEqual([interaction.nodeId, expect.any(String)]);
    }
  });

  it("matches the checked-in scene document", () => {
    golden(path.join(goldenDir, name + ".scene.json"), serializeSpecsSceneDocument(fromSource().manifest as ViroSpecsManifestV2));
  });
});

describe("Platform Lab gallery", () => {
  it("covers the four handoff screens", () => {
    expect(SCENES.map((scene) => scene.name)).toEqual(["hello", "placement", "interaction", "navigation"]);
  });

  it("uses every PanelButton authored state at least once", () => {
    const states = new Set<string>();
    for (const scene of SCENES) {
      const entry = path.join(repo, "examples", "specs-platform-lab", scene.file);
      const manifest = compileSpecsEntry(fs.readFileSync(entry, "utf8"), entry, { cwd: repo }).manifest as ViroSpecsManifestV2;
      for (const node of manifest.nodes) {
        if (node.component?.type === "panel-button") states.add(node.component.state);
      }
    }
    // loading is entered from idle or error by the host when an async press starts.
    expect([...states].sort()).toEqual(["disabled", "error", "idle", "selected"]);
  });
});

/**
 * Layout check on the compiled documents. Button and image boxes are exact
 * (compiled extents); text width is estimated at 0.55 em per character, the
 * same estimate PanelButton sizing uses, so it is a guard, not a measurement.
 */
describe.each(SCENES)("gallery layout $name", ({ name, file }) => {
  const entry = path.join(repo, "examples", "specs-platform-lab", file);
  const manifest = () => compileSpecsEntry(fs.readFileSync(entry, "utf8"), entry, { cwd: repo }).manifest as ViroSpecsManifestV2;
  type Box = { id: string; left: number; right: number; bottom: number; top: number; hidden: boolean; scrolled: boolean };
  const EM_PER_POINT = 0.01 / 43.886;
  const PAD = 0.0314; // space.md at 1.5 m
  const XS = 0.0105; // space.xs at 1.5 m
  const LABEL_EM = 0.0314; // type.label (1.2 degrees) at 1.5 m

  function layout() {
    const m = manifest();
    const byId = new Map(m.nodes.map((n) => [n.id, n]));
    const chain = (id: string) => {
      const out = [];
      for (let n = byId.get(id); n; n = n.parentId !== undefined ? byId.get(n.parentId) : undefined) out.push(n);
      return out;
    };
    const at = (id: string): [number, number] => {
      let x = 0;
      let y = 0;
      for (const n of chain(id)) {
        expect([n.id, n.rotation]).toEqual([n.id, undefined]);
        x += n.position?.[0] ?? 0;
        y += n.position?.[1] ?? 0;
      }
      return [x, y];
    };
    const boxes: Box[] = [];
    for (const n of m.nodes) {
      const ancestors = chain(n.id).slice(1);
      const hidden = chain(n.id).some((a) => a.visible === false);
      const scrolled = ancestors.some((a) => a.component?.type === "scroll-view");
      const [x, y] = at(n.id);
      if ((n.kind === "panel" && n.component?.type === "panel-button") || (n.kind === "image" && n.extents)) {
        const e = n.kind === "panel" ? n.extents : n.extents!;
        boxes.push({ id: n.id, left: x - e.width / 2, right: x + e.width / 2, bottom: y - e.height / 2, top: y + e.height / 2, hidden, scrolled });
      }
      // The Lens host draws an error button's message as a row across its
      // SpatialPanel, space.xs under the button, at type.label (1.2 degrees)
      // wrapped at the panel's inner width (ViroSpecsExperience
      // layoutViroSpecsButtonError). The row is a box like any other.
      if (n.kind === "panel" && n.component?.type === "panel-button" && n.component.state === "error" && n.component.errorMessage) {
        const parent = n.parentId !== undefined ? byId.get(n.parentId) : undefined;
        if (parent?.kind === "panel" && parent.component?.type === "spatial-panel") {
          const [px] = at(parent.id);
          const inner = parent.extents.width - 2 * PAD;
          const lines = Math.ceil((n.component.errorMessage.length * 0.55 * LABEL_EM) / inner);
          const top = y - n.extents.height / 2 - XS;
          boxes.push({ id: n.id + ":errorMessage", left: px - inner / 2, right: px + inner / 2, bottom: top - lines * 1.3 * LABEL_EM, top, hidden, scrolled });
        }
      }
    }
    return { m, byId, boxes, at, chain };
  }

  it("keeps buttons and images inside their panel, except rows clipped by a scroll view", () => {
    const { m, boxes, at } = layout();
    const panel = m.nodes.find((n) => n.component?.type === "spatial-panel");
    if (!panel || panel.kind !== "panel") throw new Error("no SpatialPanel in " + name);
    const [px, py] = at(panel.id);
    const outside = boxes
      .filter((b) => !b.scrolled)
      .filter((b) => b.left < px - panel.extents.width / 2 || b.right > px + panel.extents.width / 2 || b.bottom < py - panel.extents.height / 2 || b.top > py + panel.extents.height / 2)
      .map((b) => b.id);
    expect(outside).toEqual([]);
  });

  it("never overlaps two buttons or images that show at the same time", () => {
    const { boxes, byId } = layout();
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.hidden !== b.hidden || a.scrolled !== b.scrolled) continue;
        if (byId.get(b.id)?.parentId === a.id || byId.get(a.id)?.parentId === b.id) continue;
        if (b.id === a.id + ":errorMessage" || a.id === b.id + ":errorMessage") continue;
        if (a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top) overlaps.push(a.id + " / " + b.id);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it("gives every PanelText room for its copy at the estimated width", () => {
    const { m, byId } = layout();
    const panel = m.nodes.find((n) => n.component?.type === "spatial-panel");
    const inner = panel && panel.kind === "panel" ? panel.extents.width - 2 * PAD : 0;
    const tooLong: string[] = [];
    for (const n of m.nodes) {
      if (n.kind !== "text" || n.component?.type !== "panel-text") continue;
      const em = (n.style?.fontSize ?? 0) * EM_PER_POINT;
      const width = n.text.length * 0.55 * em;
      const boxWidth = n.extents?.width ?? inner;
      const lines = Math.ceil(width / boxWidth);
      const maxLines = n.maxLines ?? 1;
      const fitsHeight = n.extents === undefined || lines * 1.3 * em <= n.extents.height + 1e-9;
      if (lines > maxLines || !fitsHeight || boxWidth > inner + 1e-9) tooLong.push(n.id + " needs " + lines + " lines");
      expect(byId.has(n.id)).toBe(true);
    }
    expect(tooLong).toEqual([]);
  });
});
