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
