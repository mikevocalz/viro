/**
 * Golden fixtures for both Specs compilers.
 *
 * Each directory under __test__/fixtures/specs/compiler/ holds a scene.tsx,
 * a meta.json, and the expected static output: manifest.json (written with
 * serializeSpecsManifest) and diagnostics.txt (one formatted diagnostic per
 * line, hint omitted). For fixtures with `"parity": true`, the runtime
 * compiler must produce byte-identical manifests for the shared subset
 * (everything but `generator` and `source`) and the same diagnostic codes
 * on the same nodes.
 *
 * Regenerate after an intended change with
 *   UPDATE_SPECS_GOLDENS=1 npm run test:specs -- ViroSpecsGolden
 * and review the diff: a golden is a claim about behavior, not a snapshot.
 */
import * as fs from "node:fs";
import * as path from "node:path";

jest.mock("../index", () => require("./fixtures/specs/compiler/viro"));

import { compileViroSpecsChildren } from "../components/Specs/ViroSpecsCompiler";
import type { ViroSpecsDiagnostic } from "../components/Specs/core/diagnostic";
import { VIRO_SPECS_DIAGNOSTICS } from "../components/Specs/core/diagnosticCodes";
import type { ViroSpecsManifestV2 } from "../components/Specs/core/manifest";
import { serializeSpecsManifest, specsManifestSharedSubset } from "../components/Specs/core/serialize";
import { compileSpecsEntry } from "../src/specs-cli/compile";
import { SpecsPlatformLab } from "../examples/specs-platform-lab/SpecsPlatformLab";

const repo = path.join(__dirname, "..");
const fixtureRoot = path.join(__dirname, "fixtures", "specs", "compiler");
const update = process.env.UPDATE_SPECS_GOLDENS === "1";

interface FixtureMeta {
  readonly description: string;
  readonly parity: boolean;
}

const fixtures = fs
  .readdirSync(fixtureRoot)
  .filter((name) => fs.existsSync(path.join(fixtureRoot, name, "scene.tsx")))
  .sort();

function staticCompile(name: string) {
  const directory = path.join(fixtureRoot, name);
  const entry = path.join(directory, "scene.tsx");
  return compileSpecsEntry(fs.readFileSync(entry, "utf8"), entry, { cwd: directory });
}

function formatLine(diagnostic: ViroSpecsDiagnostic): string {
  const location =
    diagnostic.file !== undefined
      ? diagnostic.file + (diagnostic.line !== undefined ? ":" + diagnostic.line + ":" + diagnostic.col : "") + " "
      : "";
  return location + diagnostic.severity + " " + diagnostic.code + (diagnostic.nodeId !== undefined ? " [" + diagnostic.nodeId + "]" : "") + ": " + diagnostic.message;
}

function golden(file: string, actual: string): void {
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, actual);
    if (!update) throw new Error("Golden " + path.relative(repo, file) + " was missing and has been written. Review it and rerun.");
    return;
  }
  expect(actual).toBe(fs.readFileSync(file, "utf8"));
}

type SceneElement = { props: { children?: unknown; route?: string; actions?: unknown } };

function runtimeCompile(name: string) {
  // The fixture module registers its animations on import, like an app does.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require(path.join(fixtureRoot, name, "scene.tsx")) as { Scene: () => SceneElement };
  const element = module.Scene();
  // ViroSpecsScene passes its route and actions props the same way.
  const { route, actions } = element.props;
  return compileViroSpecsChildren(element.props.children as Parameters<typeof compileViroSpecsChildren>[0], undefined, {
    ...(route !== undefined ? { route } : {}),
    ...(actions !== undefined ? { actions: actions as Parameters<typeof compileViroSpecsChildren>[2]["actions"] } : {}),
  });
}

/** Diagnostics both compilers can report, as `CODE@nodeId`, sorted. */
function sharedCodes(diagnostics: readonly ViroSpecsDiagnostic[]): string[] {
  return diagnostics
    .filter((d) => !d.code.startsWith("VS2") && d.code !== "VS1011" && d.code !== "VS1015")
    .map((d) => d.code + "@" + (d.nodeId ?? ""))
    .sort();
}

describe("Specs compiler goldens", () => {
  it("has at least 30 fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
  });

  describe.each(fixtures)("%s", (name) => {
    const meta = JSON.parse(fs.readFileSync(path.join(fixtureRoot, name, "meta.json"), "utf8")) as FixtureMeta;

    it("static output matches manifest.json and diagnostics.txt", () => {
      const result = staticCompile(name);
      expect(result.manifest).toBeDefined();
      for (const diagnostic of result.diagnostics) {
        expect(VIRO_SPECS_DIAGNOSTICS[diagnostic.code].severity).toBe(diagnostic.severity);
      }
      golden(path.join(fixtureRoot, name, "manifest.json"), serializeSpecsManifest(result.manifest as ViroSpecsManifestV2));
      golden(
        path.join(fixtureRoot, name, "diagnostics.txt"),
        result.diagnostics.map(formatLine).join("\n") + (result.diagnostics.length ? "\n" : "")
      );
    });

    (meta.parity ? it : it.skip)("runtime manifest is byte-identical for the shared subset", () => {
      const fromSource = staticCompile(name);
      const fromRuntime = runtimeCompile(name);
      expect(serializeSpecsManifest(specsManifestSharedSubset(fromRuntime.manifest))).toBe(
        serializeSpecsManifest(specsManifestSharedSubset(fromSource.manifest as ViroSpecsManifestV2))
      );
      expect(sharedCodes(fromRuntime.diagnostics)).toEqual(sharedCodes(fromSource.diagnostics));
    });
  });
});

describe("docs/specs-parity.md", () => {
  const doc = fs.readFileSync(path.join(repo, "docs", "specs-parity.md"), "utf8");
  const references = [...doc.matchAll(/`G:([a-z0-9-]+)(=?)`/g)].map((match) => ({ name: match[1], parity: match[2] === "=" }));

  it("cites only fixtures that exist, with the right parity marker", () => {
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect([reference.name, fixtures.includes(reference.name)]).toEqual([reference.name, true]);
      const meta = JSON.parse(fs.readFileSync(path.join(fixtureRoot, reference.name, "meta.json"), "utf8")) as FixtureMeta;
      expect([reference.name, reference.parity]).toEqual([reference.name, meta.parity]);
    }
  });

  it("cites every fixture at least once", () => {
    const cited = new Set(references.map((reference) => reference.name));
    expect(fixtures.filter((name) => !cited.has(name))).toEqual([]);
  });
});

describe("Platform Lab in both paths", () => {
  const entry = path.join(repo, "examples", "specs-platform-lab", "SpecsPlatformLab.tsx");
  const source = fs.readFileSync(entry, "utf8");
  const transport = { applyScene() {} };
  const element = () =>
    SpecsPlatformLab({
      transport,
      sourceResolver: (value) => (value as { uri: string }).uri,
    }) as unknown as SceneElement;
  const children = () => element().props.children as Parameters<typeof compileViroSpecsChildren>[0];
  const golden = path.join(repo, "__test__", "fixtures", "specs", "manifest-v2", "valid", "platform-lab.json");

  it("static manifest equals the checked-in golden byte for byte", () => {
    const result = compileSpecsEntry(source, entry, { cwd: repo });
    expect(result.diagnostics).toEqual([]);
    expect(serializeSpecsManifest(result.manifest as ViroSpecsManifestV2)).toBe(fs.readFileSync(golden, "utf8"));
  });

  it("runtime and static manifests are byte-identical for the shared subset", () => {
    const fromSource = compileSpecsEntry(source, entry, { cwd: repo });
    const fromRuntime = compileViroSpecsChildren(children());
    expect(fromRuntime.diagnostics).toEqual([]);
    const runtimeBytes = serializeSpecsManifest(specsManifestSharedSubset(fromRuntime.manifest));
    const staticBytes = serializeSpecsManifest(specsManifestSharedSubset(fromSource.manifest as ViroSpecsManifestV2));
    expect(runtimeBytes).toBe(staticBytes);
    // The only difference in the full documents is provenance.
    expect(fromRuntime.manifest.generator).toEqual({ name: "viro-specs-runtime" });
    expect(fromSource.manifest?.generator).toEqual({ name: "viro-specs-compile" });
    expect(fromSource.manifest?.source).toBe("examples/specs-platform-lab/SpecsPlatformLab.tsx");
    expect(fromRuntime.manifest.source).toBeUndefined();
  });

  it("compiles in under 200 ms in each path", () => {
    const timeStatic = () => {
      const start = performance.now();
      compileSpecsEntry(source, entry, { cwd: repo });
      return performance.now() - start;
    };
    const timeRuntime = () => {
      const start = performance.now();
      compileViroSpecsChildren(children());
      return performance.now() - start;
    };
    const firstStatic = timeStatic();
    const firstRuntime = timeRuntime();
    const median = (samples: number[]) => samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
    const staticMedian = median(Array.from({ length: 25 }, timeStatic));
    const runtimeMedian = median(Array.from({ length: 25 }, timeRuntime));
    // Printed so CI logs carry the numbers recorded in docs/specs-compiler.md.
    console.log(
      "Platform Lab compile ms: static first " + firstStatic.toFixed(2) + ", median " + staticMedian.toFixed(2) +
        "; runtime first " + firstRuntime.toFixed(2) + ", median " + runtimeMedian.toFixed(2)
    );
    expect(firstStatic).toBeLessThan(200);
    expect(firstRuntime).toBeLessThan(200);
    expect(staticMedian).toBeLessThan(200);
    expect(runtimeMedian).toBeLessThan(200);
  });
});
