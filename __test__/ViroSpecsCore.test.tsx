import * as React from "react";

jest.mock("../index", () => require("./fixtures/specs/compiler/viro"));

import { compileViroSpecsChildren } from "../components/Specs/ViroSpecsCompiler";
import {
  normalizeSpecsPath,
  resolveSpecsRequest,
  specsAssetIdFromPath,
  specsContentHash,
  specsContentHashId,
  ViroSpecsIdAllocator,
} from "../components/Specs/core/ids";
import type { ViroSpecsManifestV2 } from "../components/Specs/core/manifest";
import { serializeSpecsManifest } from "../components/Specs/core/serialize";
import {
  composeSpecsTransform,
  eulerDegreesToSpecsQuaternion,
  transformSpecsPoint,
  VIRO_SPECS_IDENTITY_TRANSFORM,
} from "../components/Specs/core/transform";
import { resolveSpecsAnimation } from "../components/Specs/core/animation";
import { compileSpecsEntry } from "../src/specs-cli/compile";
import type { SpecsFileSystem } from "../src/specs-cli/modules";
import { ViroText } from "../components/ViroText";
import { ViroNode } from "../components/ViroNode";

function memoryFs(files: Record<string, string>): SpecsFileSystem {
  return {
    readFile: (filePath) => files[filePath],
    exists: (filePath) => filePath in files,
  };
}

describe("content-hash IDs", () => {
  it("is deterministic and 12 hex characters", () => {
    expect(specsContentHash("abc")).toBe(specsContentHash("abc"));
    expect(specsContentHash("abc")).toMatch(/^[0-9a-f]{12}$/);
    expect(specsContentHash("abc")).not.toBe(specsContentHash("abd"));
  });

  it("separates fields so concatenations cannot collide", () => {
    const a = specsContentHashId({ kind: "text", parentId: "ab", content: "c" }, 0);
    const b = specsContentHashId({ kind: "text", parentId: "a", content: "bc" }, 0);
    expect(a).not.toBe(b);
  });

  it("gives identical twins different IDs through the ordinal", () => {
    const allocator = new ViroSpecsIdAllocator();
    const first = allocator.allocate({ kind: "text", parentId: "p", content: "Hi" });
    const second = allocator.allocate({ kind: "text", parentId: "p", content: "Hi" });
    expect(first).not.toBe(second);
    expect(first).toBe(specsContentHashId({ kind: "text", parentId: "p", content: "Hi" }, 0));
  });

  it("keeps IDs when distinct siblings are reordered (runtime compiler)", () => {
    const hello = React.createElement(ViroText, { text: "Hello", onClick: () => {} });
    const world = React.createElement(ViroText, { text: "World" });
    const before = compileViroSpecsChildren(React.createElement(ViroNode, { viroTag: "root" }, hello, world));
    const after = compileViroSpecsChildren(React.createElement(ViroNode, { viroTag: "root" }, world, hello));
    const idOf = (compiled: typeof before, text: string) =>
      compiled.manifest.nodes.find((node) => node.kind === "text" && node.text === text)?.id;
    expect(idOf(after, "Hello")).toBe(idOf(before, "Hello"));
    expect(idOf(after, "World")).toBe(idOf(before, "World"));
    // The callback follows its element, not its position.
    expect([...before.callbacks.keys()]).toEqual([idOf(before, "Hello")]);
    expect([...after.callbacks.keys()]).toEqual([idOf(before, "Hello")]);
  });

  it("keeps IDs when distinct siblings are reordered (static compiler)", () => {
    const scene = (body: string) =>
      compileSpecsEntry(
        "export const S = () => <ViroSpecsScene><ViroNode viroTag=\"root\">" + body + "</ViroNode></ViroSpecsScene>;",
        "/project/scene.tsx",
        { cwd: "/project", rootDir: "/project", fs: memoryFs({}) }
      );
    const a = scene('<ViroText text="Hello" /><ViroText text="World" />');
    const b = scene('<ViroText text="World" /><ViroText text="Hello" />');
    const ids = (result: typeof a) =>
      Object.fromEntries((result.manifest as ViroSpecsManifestV2).nodes.map((node) => [node.kind === "text" ? node.text : node.id, node.id]));
    expect(ids(b)).toEqual(ids(a));
  });

  it("matches between the compilers for elements without viroTag", () => {
    const fromRuntime = compileViroSpecsChildren(
      React.createElement(ViroNode, null, React.createElement(ViroText, { text: "Hi" }), React.createElement(ViroText, { key: "k", text: "Hi" }))
    );
    const fromSource = compileSpecsEntry(
      'export const S = () => <ViroSpecsScene><ViroNode><ViroText text="Hi" /><ViroText key="k" text="Hi" /></ViroNode></ViroSpecsScene>;',
      "/project/scene.tsx",
      { cwd: "/project", rootDir: "/project", fs: memoryFs({}) }
    );
    expect(fromRuntime.manifest.nodes.map((node) => node.id)).toEqual(
      (fromSource.manifest as ViroSpecsManifestV2).nodes.map((node) => node.id)
    );
  });
});

describe("asset IDs", () => {
  it("normalizes separators, dot segments and drive letters", () => {
    expect(normalizeSpecsPath("C:\\app\\src\\..\\assets\\a.glb")).toBe("c:/app/assets/a.glb");
    expect(normalizeSpecsPath("/app/./src//b.png")).toBe("/app/src/b.png");
    expect(normalizeSpecsPath("../x/../y")).toBe("../y");
  });

  it("is the same on POSIX and Windows for the same project layout", () => {
    expect(specsAssetIdFromPath("/home/me/app/assets/robot.glb", "/home/me/app")).toBe("assets/robot.glb");
    expect(specsAssetIdFromPath("D:\\work\\app\\assets\\robot.glb", "d:/work/app")).toBe("assets/robot.glb");
    expect(specsAssetIdFromPath("/home/me/shared/robot.glb", "/home/me/app")).toBe("../shared/robot.glb");
  });

  it("resolves requests against the requiring file", () => {
    expect(resolveSpecsRequest("/app/src/scenes/a.tsx", "../../assets/b.glb")).toBe("/app/assets/b.glb");
    expect(resolveSpecsRequest("C:\\app\\src\\a.tsx", "./b.png")).toBe("c:/app/src/b.png");
  });

  it("does not depend on the working directory in the static compiler", () => {
    const files = {
      "/repo/package.json": "{}",
      "/repo/src/assets/robot.glb": "glTF",
    };
    const source = 'export const S = () => <ViroSpecsScene><Viro3DObject viroTag="r" source={require("./assets/robot.glb")} /></ViroSpecsScene>;';
    const fromRoot = compileSpecsEntry(source, "/repo/src/scene.tsx", { cwd: "/repo", fs: memoryFs(files) });
    const fromElsewhere = compileSpecsEntry(source, "/repo/src/scene.tsx", { cwd: "/somewhere/else", fs: memoryFs(files) });
    const windows = compileSpecsEntry(source, "C:\\repo\\src\\scene.tsx", {
      cwd: "C:\\",
      fs: memoryFs({ "c:/repo/package.json": "{}", "c:/repo/src/assets/robot.glb": "glTF" }),
    });
    const bytes = (result: typeof fromRoot) => serializeSpecsManifest(result.manifest as ViroSpecsManifestV2);
    expect(bytes(fromElsewhere)).toBe(bytes(fromRoot));
    expect(bytes(windows)).toBe(bytes(fromRoot));
    expect((fromRoot.manifest as ViroSpecsManifestV2).nodes[0]).toMatchObject({ source: "src/assets/robot.glb" });
    // Diagnostics stay relative to the working directory, for clickable output.
    expect(fromElsewhere.diagnostics).toEqual([]);
  });
});

describe("serializeSpecsManifest", () => {
  it("writes the same bytes whatever order fields were set in", () => {
    const a: ViroSpecsManifestV2 = {
      version: 2,
      nodes: [{ id: "n", kind: "text", text: "x", position: [0, 0, 0], parentId: "p" }, { id: "p", kind: "group" }],
      polylines: [],
      lights: [],
      materials: [],
      interactions: [],
      animations: [],
    };
    const b: ViroSpecsManifestV2 = {
      animations: [],
      interactions: [],
      materials: [],
      lights: [],
      polylines: [],
      nodes: [{ parentId: "p", position: [0, 0, 0], text: "x", kind: "text", id: "n" }, { kind: "group", id: "p" }],
      version: 2,
    };
    expect(serializeSpecsManifest(b)).toBe(serializeSpecsManifest(a));
    expect(serializeSpecsManifest(a).endsWith("}\n")).toBe(true);
  });
});

describe("transform core", () => {
  const close = (actual: readonly number[], expected: readonly number[]) =>
    expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 12));

  it("matches ViroCore's Euler order (X, then Y, then Z)", () => {
    // VROQuaternion::set(x, y, z) from virocore/ViroRenderer/VROQuaternion.cpp,
    // written out for [90, 90, 0] degrees.
    close(eulerDegreesToSpecsQuaternion([90, 90, 0]), [0.5, 0.5, -0.5, 0.5]);
    const rotated = transformSpecsPoint(composeSpecsTransform(VIRO_SPECS_IDENTITY_TRANSFORM, { rotation: [90, 90, 0] }), [0, 1, 0]);
    close(rotated, [1, 0, 0]);
  });
});

describe("animation core", () => {
  it("refuses division by zero instead of emitting Infinity", () => {
    const result = resolveSpecsAnimation(
      { nodeId: "n", name: "a", run: true, loop: false, delayMs: 0, base: {} },
      () => ({ properties: { scaleX: "/=0" }, duration: 100 })
    );
    expect(result.kind).toBe("none");
    expect(result.issues.map((issue) => issue.code)).toEqual(["VS3005"]);
  });

  it("reports an animation with no properties", () => {
    const result = resolveSpecsAnimation(
      { nodeId: "n", name: "a", run: true, loop: false, delayMs: 0, base: {} },
      () => ({ properties: {}, duration: 100 })
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(["VS3004"]);
  });
});

describe("static analysis edge cases", () => {
  const compile = (source: string, files: Record<string, string> = {}) =>
    compileSpecsEntry(source, "/p/scene.tsx", { cwd: "/p", rootDir: "/p", fs: memoryFs(files) });

  it("treats let bindings as runtime values and says so", () => {
    const result = compile('let X = 1;\nexport const S = () => <ViroSpecsScene><ViroNode viroTag="n" position={[X, 0, 0]} /></ViroSpecsScene>;');
    expect(result.diagnostics.map((d) => d.code)).toContain("VS2004");
    expect(result.diagnostics.find((d) => d.code === "VS2004")?.message).toMatch(/declared with let/);
  });

  it("reports package imports as VS2018 without reading node_modules", () => {
    const result = compile('import { POS } from "some-package";\nexport const S = () => <ViroSpecsScene><ViroNode viroTag="n" position={POS} /></ViroSpecsScene>;');
    const diagnostic = result.diagnostics.find((d) => d.code === "VS2018");
    expect(diagnostic?.message).toMatch(/package import/);
    expect(diagnostic?.line).toBe(2);
  });

  it("reports a missing named export", () => {
    const result = compile(
      'import { NOPE } from "./c";\nexport const S = () => <ViroSpecsScene><ViroText viroTag="t" text={NOPE} /></ViroSpecsScene>;',
      { "/p/c.ts": "export const YES = 1;" }
    );
    expect(result.diagnostics.find((d) => d.code === "VS2018")?.message).toMatch(/has no export named NOPE/);
  });

  it("names the exact expression for an unknown call", () => {
    const result = compile('export const S = () => <ViroSpecsScene><ViroText viroTag="t" text={format(1)} /></ViroSpecsScene>;');
    const diagnostic = result.diagnostics.find((d) => d.code === "VS2009");
    expect(diagnostic?.message).toContain("`format(1)`");
    // The column is the expression, not the attribute name.
    expect([diagnostic?.line, diagnostic?.col]).toEqual([1, 68]);
  });

  it("reports VS2012 for a runtime animation name and keeps the element", () => {
    const result = compile('export const S = ({ n }) => <ViroSpecsScene><ViroText viroTag="t" text="x" animation={{ name: n, run: true }} /></ViroSpecsScene>;');
    expect(result.diagnostics.map((d) => d.code)).toEqual(["VS2012"]);
    expect((result.manifest as ViroSpecsManifestV2).nodes.map((node) => node.id)).toEqual(["t"]);
  });

  it("does not compile children of unsupported components", () => {
    const result = compile('export const S = () => <ViroSpecsScene><ViroBox viroTag="b"><ViroText viroTag="t" text="x" /></ViroBox></ViroSpecsScene>;');
    expect(result.diagnostics.map((d) => d.code)).toContain("VS3001");
    expect((result.manifest as ViroSpecsManifestV2).nodes).toEqual([]);
  });

  it("does not loop on self-referencing constants", () => {
    const result = compile('const A = B;\nconst B = A;\nexport const S = () => <ViroSpecsScene><ViroText viroTag="t" text={A} /></ViroSpecsScene>;');
    expect(result.diagnostics.find((d) => d.code === "VS2009")?.message).toMatch(/refers to itself/);
  });
});
