import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { VIRO_SPECS_COPY, formatSpecsCopy } from "../components/Specs/core/copy";
import { checkSpecsExperience, specsWorldPoses, VIRO_SPECS_TEXT_EM_METERS_PER_POINT } from "../components/Specs/core/experience";
import type { ViroSpecsManifestNode, ViroSpecsManifestV2 } from "../components/Specs/core/manifest";
import {
  resolveSpecsTokens,
  specsAngleToMeters,
  specsMetersToAngle,
  VIRO_SPECS_DEFAULT_THEME,
  VIRO_SPECS_SPATIAL_TOKENS,
} from "../components/Specs/core/tokens";
import { validateSpecsManifestV2 } from "../components/Specs/core/validate";
import { toSpecsSceneSnapshot } from "../components/Specs/core/lower";
import { compileSpecsEntry } from "../src/specs-cli/compile";
import { runSpecsCli } from "../src/specs-cli/main";

const repo = path.join(__dirname, "..");
const schema: unknown = JSON.parse(fs.readFileSync(path.join(repo, "schemas", "viro-specs-manifest.v2.json"), "utf8"));
const schemaValidate = new Ajv2020({ strict: true, allErrors: true }).compile(schema as object);

function manifest(parts: Partial<ViroSpecsManifestV2>): ViroSpecsManifestV2 {
  return { version: 2, nodes: [], polylines: [], lights: [], materials: [], interactions: [], animations: [], ...parts };
}

function codes(m: ViroSpecsManifestV2): string[] {
  return checkSpecsExperience(m).map((d) => d.code + "@" + (d.nodeId ?? ""));
}

const fadeIn = (nodeId: string, overrides: Partial<ViroSpecsManifestV2["animations"][number]["plan"]> = {}) => ({
  nodeId,
  name: "fade",
  plan: {
    engine: "AnimationPlayer" as const,
    durationSeconds: 0.24,
    delaySeconds: 0,
    easing: "ease-in-out" as const,
    playbackMode: "single" as const,
    completionEvent: "fade-done",
    tracks: [{ target: "material.opacity" as const, from: "current" as const, to: 1 }],
    ...overrides,
  },
});

/** fontSize that renders `angle` degrees of em height at `distance` meters. */
function pointsFor(angle: number, distance: number): number {
  return specsAngleToMeters(angle, distance) / VIRO_SPECS_TEXT_EM_METERS_PER_POINT;
}

/** Compiles one static entry file. */
function compile(source: string) {
  const file = path.join(repo, "__virtual__", "scene.tsx");
  return compileSpecsEntry(source, file, {
    cwd: repo,
    rootDir: repo,
    fs: {
      readFile: (p: string) => (p === file ? source : undefined),
      exists: (p: string) => p === file,
    },
  });
}

describe("comfort band (VS3017)", () => {
  it("accepts content between 0.6 and 3.0 m and composes parent transforms", () => {
    const nodes: ViroSpecsManifestNode[] = [
      { id: "root", kind: "group", position: [0, 0, -2] },
      { id: "near", kind: "model", source: "a", parentId: "root", position: [0, 0, 1.39] },
      { id: "far", kind: "model", source: "a", parentId: "root", position: [0, 0, -0.99] },
    ];
    expect(codes(manifest({ nodes }))).toEqual([]);
  });

  it("reports rendered nodes nearer than 0.6 m or farther than 3.0 m", () => {
    const nodes: ViroSpecsManifestNode[] = [
      { id: "root", kind: "group", position: [0, 0, -2], scale: [2, 2, 2] },
      { id: "too-far", kind: "model", source: "a", parentId: "root", position: [0, 0, -1] },
      { id: "too-near", kind: "image", source: "a", position: [0, 0, -0.5] },
      { id: "group-only", kind: "group", position: [0, 0, -0.1] },
    ];
    expect(codes(manifest({ nodes }))).toEqual(["VS3017@too-far", "VS3017@too-near"]);
  });

  it("follows parent rotation when composing positions", () => {
    // Root turned 90 degrees about Y: a child 2 m along local -Z sits 2 m along -X.
    const s = Math.SQRT1_2;
    const nodes: ViroSpecsManifestNode[] = [
      { id: "root", kind: "group", position: [0, 0, -2.5], rotation: [0, s, 0, s] },
      { id: "m", kind: "model", source: "a", parentId: "root", position: [0, 0, -2] },
    ];
    // World position (-2, 0, -2.5): 3.2 m away.
    expect(codes(manifest({ nodes }))).toEqual(["VS3017@m"]);
  });
});

describe("angular text size (VS3018)", () => {
  it("passes text at exactly 1.2 degrees and fails just under it", () => {
    const at = (fontSize: number): ViroSpecsManifestNode => ({ id: "t", kind: "text", text: "Hi", position: [0, 0, -1.5], style: { fontSize } });
    expect(codes(manifest({ nodes: [at(Math.ceil(pointsFor(1.2, 1.5)))] }))).toEqual([]);
    expect(codes(manifest({ nodes: [at(Math.floor(pointsFor(1.2, 1.5)) - 1)] }))).toEqual(["VS3018@t"]);
  });

  it("checks text without fontSize at the host default of 48 points", () => {
    const [diagnostic] = checkSpecsExperience(manifest({ nodes: [{ id: "t", kind: "text", text: "Hi", position: [0, 0, -1.5] }] }));
    expect(diagnostic.code).toBe("VS3018");
    expect(diagnostic.message).toContain("fontSize 48");
  });

  it("counts the node's world scale", () => {
    const nodes: ViroSpecsManifestNode[] = [
      { id: "g", kind: "group", position: [0, 0, -1.5], scale: [3, 3, 3] },
      { id: "t", kind: "text", text: "Hi", parentId: "g", style: { fontSize: 48 } },
    ];
    expect(codes(manifest({ nodes }))).toEqual([]);
  });

  it("matches the token sheet: 1.2 degrees at 1.5 m is 3.14 cm", () => {
    expect(specsAngleToMeters(1.2, 1.5)).toBeCloseTo(0.0314, 4);
    expect(specsAngleToMeters(1.2, 0.6)).toBeCloseTo(0.0126, 4);
    expect(specsAngleToMeters(1.2, 3.0)).toBeCloseTo(0.0628, 4);
    expect(specsMetersToAngle(specsAngleToMeters(2, 1.5), 1.5)).toBeCloseTo(2, 9);
  });
});

describe("motion (VS3019, VS3020, VS3021)", () => {
  const panel: ViroSpecsManifestNode = { id: "p", kind: "panel", position: [0, 0, -1.5], extents: { width: 0.53, height: 0.4 } };
  const small: ViroSpecsManifestNode = { id: "s", kind: "panel", position: [0, 0, -1.5], extents: { width: 0.05, height: 0.05 } };

  it("accepts 500 ms ease-in-out and rejects 501 ms", () => {
    expect(codes(manifest({ nodes: [small], animations: [fadeIn("s", { durationSeconds: 0.5 })] }))).toEqual([]);
    expect(codes(manifest({ nodes: [small], animations: [fadeIn("s", { durationSeconds: 0.501 })] }))).toEqual(["VS3019@s"]);
  });

  it("reports every easing but ease-in-out", () => {
    for (const easing of ["linear", "ease-in", "ease-out"] as const) {
      expect(codes(manifest({ nodes: [small], animations: [fadeIn("s", { easing })] }))).toEqual(["VS3020@s"]);
    }
  });

  it("reports a large surface that translates, not one that fades or scales in place", () => {
    const move = fadeIn("p", { tracks: [{ target: "transform.position.x", from: "current", to: 0.4 }] });
    const scale = fadeIn("p", { tracks: [{ target: "transform.scale.x", from: "current", to: 1.04 }] });
    const noOp = fadeIn("p", { tracks: [{ target: "transform.position.x", from: "current", to: 0 }] });
    expect(codes(manifest({ nodes: [panel], animations: [move] }))).toEqual(["VS3021@p"]);
    expect(codes(manifest({ nodes: [panel], animations: [scale] }))).toEqual([]);
    expect(codes(manifest({ nodes: [panel], animations: [noOp] }))).toEqual([]);
  });

  it("finds a large surface carried by a moving group and leaves small objects alone", () => {
    const nodes: ViroSpecsManifestNode[] = [
      { id: "g", kind: "group", position: [0, 0, -1.5] },
      { ...panel, id: "child", parentId: "g", position: [0, 0, 0] },
    ];
    const move = fadeIn("g", { tracks: [{ target: "transform.position.y", from: "current", to: 0.3 }] });
    expect(codes(manifest({ nodes, animations: [move] }))).toEqual(["VS3021@g"]);
    const nudge = fadeIn("s", { tracks: [{ target: "transform.position.y", from: "current", to: 0.3 }] });
    expect(codes(manifest({ nodes: [small], animations: [nudge] }))).toEqual([]);
  });
});

describe("labels (VS3016)", () => {
  const interaction = (nodeId: string) => ({ nodeId, interactable: true as const, manipulation: false, events: ["select" as const] });

  it("reports an interactable without a label and accepts one with a label", () => {
    const nodes: ViroSpecsManifestNode[] = [
      { id: "a", kind: "model", source: "m", position: [0, 0, -1.5] },
      { id: "b", kind: "model", source: "m", position: [0, 0, -1.5], label: "Reset model" },
      { id: "c", kind: "model", source: "m", position: [0, 0, -1.5], label: "   " },
    ];
    const m = manifest({ nodes, interactions: [interaction("a"), interaction("b"), interaction("c")] });
    expect(codes(m)).toEqual(["VS3016@a", "VS3016@c"]);
    expect(checkSpecsExperience(m)[0].fieldPath).toBe("/interactions/0");
  });

  it("reads accessibilityLabel on Viro elements and label on premium components", () => {
    const result = compile(
      'import { ViroSpecsScene, Viro3DObject, PanelButton } from "@reactvision/react-viro";\n' +
        "export const S = () => <ViroSpecsScene>\n" +
        '  <Viro3DObject viroTag="m" source="model-id" type="GLB" position={[0, 0, -1.5]} accessibilityLabel="Shiba model" onClick={() => {}} />\n' +
        '  <Viro3DObject viroTag="unlabelled" source="model-id" type="GLB" position={[0, 0, -1.5]} onClick={() => {}} />\n' +
        '  <PanelButton viroTag="b" label="Next scene" position={[0, -0.2, -1.5]} onPress={() => {}} />\n' +
        "</ViroSpecsScene>;"
    );
    const m = result.manifest as ViroSpecsManifestV2;
    expect(m.nodes.find((n) => n.id === "m")?.label).toBe("Shiba model");
    expect(m.nodes.find((n) => n.id === "b")?.label).toBe("Next scene");
    expect(result.diagnostics.map((d) => d.code + "@" + d.nodeId)).toEqual(["VS3016@unlabelled"]);
    expect(result.diagnostics[0].line).toBe(4);
  });

  it("fails viro-specs-compile --strict on a missing label and passes when it is added", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-label-"));
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    const write = (body: string) => {
      fs.writeFileSync(
        path.join(dir, "scene.tsx"),
        'import { ViroSpecsScene, ViroNode } from "@reactvision/react-viro";\nexport const S = () => <ViroSpecsScene>' + body + "</ViroSpecsScene>;\n"
      );
    };
    const errors: string[] = [];
    const io = { stderr: (line: string) => errors.push(line), stdout: () => {} };
    const run = () => runSpecsCli(["--entry", path.join(dir, "scene.tsx"), "--out", path.join(dir, "out.json"), "--strict"], io);

    write('<ViroNode viroTag="n" position={[0, 0, -1.5]} onClick={() => {}} />');
    expect(run()).toBe(1);
    expect(errors.join("\n")).toContain("VS3016");
    expect(fs.existsSync(path.join(dir, "out.json"))).toBe(false);

    errors.length = 0;
    write('<ViroNode viroTag="n" position={[0, 0, -1.5]} accessibilityLabel="Open card" onClick={() => {}} />');
    expect(run()).toBe(0);
    expect(errors).toEqual([]);
  });

  it("runs the comfort and label checks on hand-written manifests (--manifest)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-manifest-"));
    const input = path.join(dir, "scene.json");
    fs.writeFileSync(
      input,
      JSON.stringify(manifest({
        nodes: [{ id: "a", kind: "model", source: "m", position: [0, 0, -5] }],
        interactions: [interaction("a")],
      }))
    );
    const errors: string[] = [];
    const status = runSpecsCli(["--manifest", input, "--out", path.join(dir, "out.json"), "--strict"], { stderr: (l: string) => errors.push(l), stdout: () => {} });
    expect(status).toBe(1);
    expect(errors.join("\n")).toMatch(/VS3016[\s\S]*|VS3017/);
    expect(errors.join("\n")).toContain("VS3017");
  });
});

describe("premium components", () => {
  const scene = (body: string) =>
    'import { ViroSpecsScene, SpatialPanel, PanelText, PanelButton, PanelImage, SpatialScrollView, ModelViewer } from "@reactvision/react-viro";\n' +
    "export const S = () => <ViroSpecsScene>" + body + "</ViroSpecsScene>;";

  it("sizes PanelText from the type tokens at the node's distance", () => {
    for (const [distance, role, deg] of [[1.5, "body", 1.4], [3, "title", 2.0], [0.6, "label", 1.2]] as const) {
      const result = compile(scene('<PanelText viroTag="t" role="' + role + '" text="Hi" position={[0, 0, -' + distance + ']} />'));
      expect(result.diagnostics).toEqual([]);
      const node = (result.manifest as ViroSpecsManifestV2).nodes[0];
      expect(node.kind).toBe("text");
      if (node.kind !== "text") return;
      const fontSize = node.style?.fontSize ?? 0;
      expect(specsMetersToAngle(fontSize * VIRO_SPECS_TEXT_EM_METERS_PER_POINT, distance)).toBeGreaterThanOrEqual(deg);
      expect(specsMetersToAngle(fontSize * VIRO_SPECS_TEXT_EM_METERS_PER_POINT, distance)).toBeLessThan(deg + 0.01);
      expect(node.component).toEqual({ type: "panel-text", role, tone: "default" });
    }
  });

  it("compiles every component to its node kind with a component spec and writes the theme", () => {
    const result = compile(scene(
      '<SpatialPanel viroTag="p" title="Hello" position={[0, 0, -1.5]}>' +
        '<PanelButton viroTag="b" label="Next scene" state="selected" onPress={() => {}} />' +
        '<PanelImage viroTag="i" source="img" width={0.1} height={0.1} />' +
        '<SpatialScrollView viroTag="s" width={0.4} height={0.3} itemHeight={0.1} initialIndex={2} />' +
        '<ModelViewer viroTag="m" label="Shiba model" source="model" type="GLB" autoRotate={true} onDrag={() => {}} />' +
      "</SpatialPanel>"
    ));
    expect(result.diagnostics).toEqual([]);
    const m = result.manifest as ViroSpecsManifestV2;
    expect(m.nodes.map((n) => [n.id, n.kind, n.component?.type])).toEqual([
      ["p", "panel", "spatial-panel"],
      ["b", "panel", "panel-button"],
      ["i", "image", "panel-image"],
      ["s", "group", "scroll-view"],
      ["m", "model", "model-viewer"],
    ]);
    expect(m.nodes[1].component).toEqual({ type: "panel-button", state: "selected" });
    expect(m.nodes[3].component).toEqual({ type: "scroll-view", itemHeightMeters: 0.1, initialIndex: 2 });
    expect(m.nodes[3].kind === "group" ? m.nodes[3].scroll : undefined).toEqual({ width: 0.4, height: 0.3, contentHeight: 0.3 });
    expect(m.nodes[4].component).toEqual({ type: "model-viewer", autoRotate: true, resettable: true });
    expect(m.interactions.map((i) => [i.nodeId, i.events])).toEqual([["b", ["hover", "select"]], ["m", ["drag"]]]);
    expect(m.theme).toEqual(VIRO_SPECS_DEFAULT_THEME);
    expect(schemaValidate(m) ? [] : schemaValidate.errors).toEqual([]);
  });

  it("writes no theme when no premium component compiled", () => {
    const result = compile(scene('<SpatialPanel viroTag="p" position={[0, 0, -1.5]} />').replace("<SpatialPanel", "<ViroNode").replace("SpatialPanel,", "ViroNode,"));
    expect((result.manifest as ViroSpecsManifestV2).theme).toBeUndefined();
  });

  it("reports VS3022 for a PanelButton without a label and an unknown state", () => {
    const missing = compile(scene('<PanelText viroTag="t" text="Hi" position={[0, 0, -1.5]} /><PanelButton viroTag="b" position={[0, 0, -1.5]} />'));
    expect(missing.diagnostics.map((d) => d.code)).toEqual(["VS3022"]);
    expect((missing.manifest as ViroSpecsManifestV2).nodes.map((n) => n.id)).toEqual(["t"]);
    const badState = compile(scene('<PanelButton viroTag="b" label="Go" state="hovered" position={[0, 0, -1.5]} />'));
    expect(badState.diagnostics.map((d) => [d.code, d.message.includes("one of idle, selected, disabled, loading, error")])).toEqual([["VS3022", true]]);
  });

  describe("SpatialScrollView", () => {
    // Eight rows of 0.1 m from the viewport top; the viewport shows three.
    const rows = Array.from({ length: 8 }, (_, i) =>
      '<PanelButton viroTag="r' + i + '" label="Row ' + (i + 1) + '" position={[0, ' + (0.1 - i * 0.1).toFixed(2) + ', 0]} width={0.3} height={0.08} onPress={() => {}} />'
    ).join("");
    const list = (props: string) =>
      compile(scene('<SpatialPanel viroTag="p" position={[0, 0, -1.5]} width={0.53} height={0.5}><SpatialScrollView viroTag="s" ' + props + ">" + rows + "</SpatialScrollView></SpatialPanel>"));

    it("compiles to a scroll group sized from its children, in whole rows", () => {
      const result = list("width={0.4} height={0.3} itemHeight={0.1} initialIndex={2}");
      expect(result.diagnostics).toEqual([]);
      const m = result.manifest as ViroSpecsManifestV2;
      const view = m.nodes.find((n) => n.id === "s");
      // Lowest row bottom: 0.1 - 0.7 - 0.04 = -0.64; from the top (0.15) that is
      // 0.79 m, so five rows past the 0.3 m viewport: 0.8 m.
      expect(view).toEqual({
        id: "s",
        kind: "group",
        parentId: "p",
        scroll: { width: 0.4, height: 0.3, contentHeight: 0.8 },
        component: { type: "scroll-view", itemHeightMeters: 0.1, initialIndex: 2 },
      });
      expect(schemaValidate(m) ? [] : schemaValidate.errors).toEqual([]);
    });

    it("moves direct children half a viewport down so the host shows them where they were authored", () => {
      const m = list("width={0.4} height={0.3} itemHeight={0.1}").manifest as ViroSpecsManifestV2;
      const y = (id: string) => m.nodes.find((n) => n.id === id)?.position?.[1];
      expect([y("r0"), y("r1"), y("r7")]).toEqual([-0.05, -0.15, -0.75]);
      // The comfort checks place them back at their authored world height.
      const poses = specsWorldPoses(m.nodes);
      expect(poses.get("r0")?.position[1]).toBeCloseTo(0.1, 9);
      expect(poses.get("r7")?.position[1]).toBeCloseTo(-0.6, 9);
      expect(codes(m)).toEqual([]);
    });

    it("needs no extra rows when the children fit the viewport", () => {
      const result = compile(scene(
        '<SpatialScrollView viroTag="s" position={[0, 0, -1.5]} width={0.4} height={0.3} itemHeight={0.1}>' +
          '<PanelButton viroTag="a" label="A" position={[0, 0.1, 0]} width={0.3} height={0.08} onPress={() => {}} />' +
        "</SpatialScrollView>"
      ));
      const view = (result.manifest as ViroSpecsManifestV2).nodes[0];
      expect(view.kind === "group" ? view.scroll : undefined).toEqual({ width: 0.4, height: 0.3, contentHeight: 0.3 });
    });

    it("is rejected on a panel and without a scroll window, by validation and the schema", () => {
      const panel = manifest({ nodes: [{ id: "s", kind: "panel", extents: { width: 0.4, height: 0.3 }, component: { type: "scroll-view", itemHeightMeters: 0.1, initialIndex: 0 } }] });
      const bare = manifest({ nodes: [{ id: "s", kind: "group", component: { type: "scroll-view", itemHeightMeters: 0.1, initialIndex: 0 } }] });
      expect(validateSpecsManifestV2(panel).diagnostics.map((d) => d.code + "@" + d.fieldPath)).toContain("VS1004@/nodes/0/component/type");
      expect(validateSpecsManifestV2(bare).diagnostics.map((d) => d.code + "@" + d.fieldPath)).toEqual(["VS1005@/nodes/0/scroll"]);
      expect([schemaValidate(panel), schemaValidate(bare)]).toEqual([false, false]);
    });
  });

  it("reports VS3022 for a SpatialScrollView without its viewport", () => {
    const result = compile(scene('<PanelText viroTag="t" text="Hi" position={[0, 0, -1.5]} /><SpatialScrollView viroTag="s" width={0.4} position={[0, 0, -1.5]} />'));
    expect(result.diagnostics.map((d) => d.code + ":" + d.message.split(" needs ")[1])).toEqual(["VS3022:height in meters.", "VS3022:itemHeight in meters."]);
  });

  it("keeps label and component out of the protocol 1 snapshot with VS1015", () => {
    const m = compile(scene('<PanelButton viroTag="b" label="Go" position={[0, 0, -1.5]} />')).manifest as ViroSpecsManifestV2;
    const lowered = toSpecsSceneSnapshot(m);
    expect(lowered.diagnostics.map((d) => d.fieldPath)).toEqual(["/nodes/0/label", "/nodes/0/extents", "/nodes/0/component", "/theme"]);
  });
});

describe("manifest validation of label, component and theme", () => {
  it("accepts the default theme and rejects bad tokens, kinds and fields", () => {
    const ok = manifest({ theme: VIRO_SPECS_DEFAULT_THEME, nodes: [{ id: "t", kind: "text", text: "x", component: { type: "panel-text", role: "body", tone: "muted" } }] });
    expect(validateSpecsManifestV2(ok).ok).toBe(true);
    expect(schemaValidate(ok)).toBe(true);

    const cases: readonly [string, unknown, string][] = [
      ["bad color", { ...ok, theme: { ...VIRO_SPECS_DEFAULT_THEME, tokens: { ...VIRO_SPECS_SPATIAL_TOKENS, color: { ...VIRO_SPECS_SPATIAL_TOKENS.color, focus: "amber" } } } }, "VS1004@/theme/tokens/color/focus"],
      ["unknown token", { ...ok, theme: { ...VIRO_SPECS_DEFAULT_THEME, tokens: { ...VIRO_SPECS_SPATIAL_TOKENS, extra: {} } } }, "VS1006@/theme/tokens/extra"],
      ["missing token", { ...ok, theme: { ...VIRO_SPECS_DEFAULT_THEME, tokens: { ...VIRO_SPECS_SPATIAL_TOKENS, input: { gazeDwellMs: 1000 } } } }, "VS1005@/theme/tokens/input/lookAwayCancelMs"],
      ["component on wrong kind", { ...ok, nodes: [{ id: "g", kind: "image", source: "x", component: { type: "panel-button", state: "idle" } }] }, "VS1004@/nodes/0/component/type"],
      ["component on a group", { ...ok, nodes: [{ id: "g", kind: "group", component: { type: "spatial-panel" } }] }, "VS1004@/nodes/0/component/type"],
      ["empty label", { ...ok, nodes: [{ id: "g", kind: "group", label: "" }] }, "VS1004@/nodes/0/label"],
      ["bad state", { ...ok, nodes: [{ id: "b", kind: "panel", extents: { width: 1, height: 1 }, component: { type: "panel-button", state: "hover" } }] }, "VS1004@/nodes/0/component/state"],
    ];
    for (const [name, input, expected] of cases) {
      const result = validateSpecsManifestV2(input);
      expect([name, result.ok]).toEqual([name, false]);
      expect([name, result.diagnostics.map((d) => d.code + "@" + d.fieldPath)]).toEqual([name, expect.arrayContaining([expected])]);
      expect([name, schemaValidate(input)]).toEqual([name, false]);
    }
  });
});

describe("tokens", () => {
  it("match the hex values and numbers in docs/ux/spatial-tokens.md", () => {
    const doc = fs.readFileSync(path.join(repo, "docs", "ux", "spatial-tokens.md"), "utf8");
    for (const [name, hex] of Object.entries(VIRO_SPECS_SPATIAL_TOKENS.color)) {
      expect([name, doc.toLowerCase().includes("`color." + name.toLowerCase() + "` | " + hex)]).toEqual([name, true]);
    }
    for (const [name, hex] of Object.entries(VIRO_SPECS_SPATIAL_TOKENS.tint)) {
      if (typeof hex === "string") expect([name, doc.toLowerCase().includes("`tint." + name + "` | " + hex)]).toEqual([name, true]);
    }
    expect(doc).toContain("| `motion.max` | 500 ms |");
    expect(doc).toContain("| `type.label` | 1.2 deg |");
  });

  it("applies high contrast and reduced motion", () => {
    const hc = resolveSpecsTokens(VIRO_SPECS_DEFAULT_THEME, { highContrast: true, reducedMotion: false });
    expect(hc.color.surface).toBe("#42525f");
    expect(hc.color.text).toBe("#ffffff");
    expect(hc.color.textMuted).toBe("#ffffff");
    expect(hc.color.focus).toBe("#ffd25e");
    expect(hc.opacity.surface).toBe(1);
    expect(hc.shape.borderWidthDeg).toBeCloseTo(0.3, 9);
    expect(hc.type.labelDeg).toBeCloseTo(1.4, 9);
    expect(hc.motion.hoverScale).toBe(1.04);

    const rm = resolveSpecsTokens(VIRO_SPECS_DEFAULT_THEME, { highContrast: false, reducedMotion: true });
    expect(rm.motion.hoverScale).toBe(1);
    expect(rm.motion.appearScaleFrom).toBe(1);
    expect(rm.color).toEqual(VIRO_SPECS_SPATIAL_TOKENS.color);
    expect(resolveSpecsTokens(VIRO_SPECS_DEFAULT_THEME)).toEqual(VIRO_SPECS_SPATIAL_TOKENS);
  });

  // SPECS is an additive display: a pixel adds light to the room and black
  // adds none, so a black panel shows as no panel. High contrast must keep
  // every surface it can draw visible and still meet 7:1 (1.4.6) for text.
  it("never resolves a high-contrast surface to black or near-black", () => {
    const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // Near-black: dimmer than the default panel surface (#1b2630, relative
    // luminance 0.018), the dimmest surface the Preview captures show.
    const NEAR_BLACK = 0.015;
    const hc = resolveSpecsTokens(VIRO_SPECS_DEFAULT_THEME, { highContrast: true, reducedMotion: false });
    const surfaces = Object.entries(hc.color).filter(([name]) => /surface|fill/i.test(name));
    expect(surfaces.map(([name]) => name).sort()).toEqual(["degradedSurface", "errorSurface", "selectedFill", "surface", "surfacePressed", "surfaceRaised"]);
    expect(surfaces.filter(([, hex]) => luminance(hex) < NEAR_BLACK)).toEqual([]);
    expect(luminance(hc.color.surface)).toBeGreaterThan(luminance(VIRO_SPECS_SPATIAL_TOKENS.color.surface));
    expect(ratio(hc.color.text, hc.color.surface)).toBeGreaterThanOrEqual(7);
    expect(ratio(hc.color.textMuted, hc.color.surface)).toBeGreaterThanOrEqual(7);
    expect(ratio(hc.color.focus, hc.color.surface)).toBeGreaterThanOrEqual(3);
    expect(ratio(hc.color.border, hc.color.surface)).toBeGreaterThanOrEqual(3);
  });

  it("keeps every duration at or under the motion cap, except the exempt progress loop", () => {
    const m = VIRO_SPECS_SPATIAL_TOKENS.motion;
    for (const value of [m.fastMs, m.baseMs, m.slowMs]) expect(value).toBeLessThanOrEqual(m.maxMs);
    expect(m.progressLoopMs).toBeGreaterThan(m.maxMs);
  });
});

describe("copy", () => {
  const doc = fs.readFileSync(path.join(repo, "docs", "ux", "copy.md"), "utf8");

  /** Every `key` | copy pair in the doc's tables, with the error table expanded to .title/.message/.action. */
  function documented(): Map<string, string> {
    const out = new Map<string, string>();
    for (const line of doc.split("\n")) {
      const cells = line.split("|").map((cell) => cell.trim());
      const key = /^`([\w.]+)`$/.exec(cells[1] ?? "")?.[1];
      if (key === undefined) continue;
      if (key.startsWith("error.") && cells.length >= 7 && !key.endsWith(".title")) {
        out.set(key + ".title", cells[3]);
        out.set(key + ".message", cells[4]);
        out.set(key + ".action", cells[5]);
      } else if (key.startsWith("degraded.") && cells.length >= 6) {
        // Key | trigger | copy | budget.
        out.set(key, cells[3]);
      } else {
        out.set(key, cells[2]);
      }
    }
    return out;
  }

  it("matches docs/ux/copy.md key for key and string for string", () => {
    const doc = documented();
    const missingInCode = [...doc.keys()].filter((key) => !(key in VIRO_SPECS_COPY));
    expect(missingInCode).toEqual([]);
    for (const [key, text] of Object.entries(VIRO_SPECS_COPY)) {
      expect([key, doc.get(key)]).toEqual([key, text]);
    }
  });

  it("fills placeholders and leaves a missing one visible", () => {
    expect(formatSpecsCopy("loading.progress", { done: 2, total: 5 })).toBe("Loading 2 of 5");
    expect(formatSpecsCopy("placement.surface", {})).toBe("{surface}. Pinch to place.");
  });

  it("keeps the banned error phrases out", () => {
    const all = Object.values(VIRO_SPECS_COPY).join("\n");
    for (const banned of ["Oops", "Something went wrong", "An error occurred", "Please try again"]) {
      expect([banned, all.includes(banned)]).toEqual([banned, false]);
    }
  });
});

describe("review fixes", () => {
  const scene = (body: string) =>
    'import { ViroSpecsScene, PanelText, PanelImage } from "@reactvision/react-viro";\nexport const S = () => <ViroSpecsScene>' + body + "</ViroSpecsScene>;";

  it("reports VS3022 when PanelText or PanelImage has only one dimension", () => {
    const text = compile(scene('<PanelText viroTag="t" text="Hi" width={0.4} position={[0, 0, -1.5]} />'));
    expect(text.diagnostics.map((d) => d.code + ":" + d.nodeId)).toEqual(["VS3022:t"]);
    const node = (text.manifest as ViroSpecsManifestV2).nodes[0];
    expect("extents" in node).toBe(false);
    const image = compile(scene('<PanelImage viroTag="i" source="img" height={0.1} position={[0, 0, -1.5]} />'));
    expect(image.diagnostics.map((d) => d.code + ":" + d.nodeId)).toEqual(["VS3022:i"]);
  });
});
