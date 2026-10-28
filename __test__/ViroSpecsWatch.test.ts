/**
 * `viro-specs watch`: atomic writes, last valid output kept on a failed
 * build, ledger-owned files (user edits and foreign files kept, Lens .meta
 * files untouched, nothing deleted) and rebuilds when an imported module
 * changes.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GENERATED_LEDGER_NAME, readGeneratedLedger, sha256Text, writeGeneratedFiles } from "../src/specs-cli/generatedFiles";
import { buildSpecsWatchOutputs, parseSpecsWatchArgs, startSpecsWatcher, type SpecsWatchArgs } from "../src/specs-cli/watch";

const SCENE = (title: string) => `import * as React from "react";
import { ViroSpecsScene, ViroText } from "./viro";
import { TITLE_Y } from "./layout";

const transport = { applyScene() {} };

export function Scene() {
  return (
    <ViroSpecsScene transport={transport}>
      <ViroText viroTag="title" text=${JSON.stringify(title)} position={[0, TITLE_Y, -1]} />
    </ViroSpecsScene>
  );
}
`;

let dir: string;
let out: string;

function project(title = "Hello"): string {
  fs.writeFileSync(path.join(dir, "package.json"), "{}");
  fs.writeFileSync(path.join(dir, "viro.ts"), 'export const ViroSpecsScene = "ViroSpecsScene";\nexport const ViroText = "ViroText";\n');
  fs.writeFileSync(path.join(dir, "layout.ts"), "export const TITLE_Y = 0.2;\n");
  const entry = path.join(dir, "Scene.tsx");
  fs.writeFileSync(entry, SCENE(title));
  return entry;
}

function args(entry: string, extra: string[] = []): SpecsWatchArgs {
  const parsed = parseSpecsWatchArgs(["--entry", entry, "--out-dir", out, "--format", "lens-ts,scene-json,json", ...extra]);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed;
}

const read = (name: string): string => fs.readFileSync(path.join(out, name), "utf8");
const listing = (): string[] => fs.readdirSync(out).sort();

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-watch-"));
  out = path.join(dir, "Assets", "ViroSpecs", "generated");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("argument parsing", () => {
  it("defaults to lens-ts and scene-json and rejects unknown formats", () => {
    const parsed = parseSpecsWatchArgs(["--entry", "a.tsx", "--out-dir", "o"]);
    expect("error" in parsed ? parsed.error : parsed.formats).toEqual(["lens-ts", "scene-json"]);
    expect("error" in parseSpecsWatchArgs(["--entry", "a.tsx", "--out-dir", "o", "--format", "yaml"])).toBe(true);
    expect("error" in parseSpecsWatchArgs(["--entry", "a.tsx"])).toBe(true);
    expect("error" in parseSpecsWatchArgs(["--entry", "a.tsx", "--manifest", "m.json", "--out-dir", "o"])).toBe(true);
  });
});

describe("builds", () => {
  it("writes every format, records them in the ledger, and lists the imported modules as inputs", () => {
    const entry = project();
    const build = buildSpecsWatchOutputs(args(entry));
    expect(build.ok).toBe(true);
    if (!build.ok) return;
    expect(build.files.map((f) => [f.name, f.status])).toEqual([
      ["ViroGeneratedSceneHost.ts", "created"],
      ["Scene.scene.json", "created"],
      ["Scene.manifest.json", "created"],
    ]);
    expect(build.inputs).toEqual(expect.arrayContaining([entry, path.join(dir, "layout.ts")]));
    const ledger = readGeneratedLedger(out);
    expect(ledger.files["Scene.scene.json"]?.sha256).toBe(sha256Text(read("Scene.scene.json")));
    expect(JSON.parse(read("Scene.scene.json")).nodes[0].position).toEqual([0, 0.2, -1]);
    // No temporary files are left next to the outputs.
    expect(listing()).toEqual([GENERATED_LEDGER_NAME, "Scene.manifest.json", "Scene.scene.json", "ViroGeneratedSceneHost.ts"].sort());
  });

  it("a failed build writes nothing and keeps the last valid output byte for byte", () => {
    const entry = project();
    expect(buildSpecsWatchOutputs(args(entry)).ok).toBe(true);
    const before = Object.fromEntries(listing().map((n) => [n, read(n)]));
    fs.writeFileSync(entry, "export function Scene( {");
    const failed = buildSpecsWatchOutputs(args(entry));
    expect(failed.ok).toBe(false);
    expect(failed.diagnostics.map((d) => d.code)).toContain("VS2015");
    expect(Object.fromEntries(listing().map((n) => [n, read(n)]))).toEqual(before);
  });

  it("--strict refuses a build with warnings and keeps the previous output", () => {
    const entry = project();
    expect(buildSpecsWatchOutputs(args(entry)).ok).toBe(true);
    const before = read("Scene.scene.json");
    // No viroTag: a warning, so only --strict refuses it.
    fs.writeFileSync(entry, SCENE("Untagged").replace('viroTag="title" ', ""));
    const strict = buildSpecsWatchOutputs(args(entry, ["--strict"]));
    expect(strict.ok).toBe(false);
    expect(read("Scene.scene.json")).toBe(before);
    const loose = buildSpecsWatchOutputs(args(entry));
    expect(loose.ok).toBe(true);
    expect(read("Scene.scene.json")).toContain("Untagged");
  });
});

describe("safe upgrades", () => {
  it("keeps Lens .meta files byte for byte and replaces SDK-owned files in place", () => {
    const entry = project("Hello");
    buildSpecsWatchOutputs(args(entry));
    const meta = "- !<AssetImportMetadata/4f8c>\n  ImportedAssetIds:\n    TypeScriptAsset: 7a3e-uuid\n";
    fs.writeFileSync(path.join(out, "ViroGeneratedSceneHost.ts.meta"), meta);
    fs.writeFileSync(entry, SCENE("Hello again"));
    const build = buildSpecsWatchOutputs(args(entry));
    expect(build.ok && build.files.find((f) => f.name === "ViroGeneratedSceneHost.ts")?.status).toBe("updated");
    expect(read("ViroGeneratedSceneHost.ts")).toContain("Hello again");
    expect(read("ViroGeneratedSceneHost.ts.meta")).toBe(meta);
  });

  it("identical output is not rewritten (mtime unchanged)", () => {
    const entry = project();
    buildSpecsWatchOutputs(args(entry));
    const file = path.join(out, "Scene.scene.json");
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(file, old, old);
    const build = buildSpecsWatchOutputs(args(entry));
    expect(build.ok && build.files.every((f) => f.status === "unchanged")).toBe(true);
    expect(fs.statSync(file).mtimeMs).toBe(old.getTime());
  });

  it("keeps a user-edited file, keeps reporting it, and replaces it only with --force-overwrite", () => {
    const entry = project("Hello");
    buildSpecsWatchOutputs(args(entry));
    const edited = read("ViroGeneratedSceneHost.ts") + "\n// tuned by hand\n";
    fs.writeFileSync(path.join(out, "ViroGeneratedSceneHost.ts"), edited);
    fs.writeFileSync(entry, SCENE("Changed"));
    for (let i = 0; i < 2; i++) {
      const build = buildSpecsWatchOutputs(args(entry));
      expect(build.ok && build.files.find((f) => f.name === "ViroGeneratedSceneHost.ts")?.status).toBe("kept-user-edit");
      expect(read("ViroGeneratedSceneHost.ts")).toBe(edited);
    }
    expect(read("Scene.scene.json")).toContain("Changed");
    const forced = buildSpecsWatchOutputs(args(entry, ["--force-overwrite", "ViroGeneratedSceneHost.ts"]));
    expect(forced.ok && forced.files.find((f) => f.name === "ViroGeneratedSceneHost.ts")?.status).toBe("overwritten");
    expect(read("ViroGeneratedSceneHost.ts")).toContain("Changed");
  });

  it("never overwrites a file it did not write, and never deletes anything", () => {
    const entry = project();
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "Scene.scene.json"), "{ \"mine\": true }\n");
    fs.writeFileSync(path.join(out, "Notes.md"), "keep me\n");
    const first = buildSpecsWatchOutputs(args(entry));
    expect(first.ok && first.files.find((f) => f.name === "Scene.scene.json")?.status).toBe("kept-foreign");
    expect(read("Scene.scene.json")).toBe("{ \"mine\": true }\n");
    // Dropping a format later leaves its old file in place.
    const narrowed = parseSpecsWatchArgs(["--entry", entry, "--out-dir", out, "--format", "lens-ts"]);
    if ("error" in narrowed) throw new Error(narrowed.error);
    buildSpecsWatchOutputs(narrowed);
    expect(listing()).toEqual(expect.arrayContaining(["Notes.md", "Scene.manifest.json", "Scene.scene.json"]));
  });

  it("rejects output names that escape the output directory", () => {
    expect(() => writeGeneratedFiles(out, [{ name: "../escape.ts", content: "" }])).toThrow(/plain relative path/);
  });
});

describe("watching", () => {
  const until = async (check: () => boolean, ms = 8000): Promise<void> => {
    const end = Date.now() + ms;
    while (!check()) {
      if (Date.now() > end) throw new Error("timed out");
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  it("rebuilds when an imported module changes, and recovers after a broken save", async () => {
    const entry = project();
    const lines: string[] = [];
    const watcher = startSpecsWatcher(args(entry, ["--debounce-ms", "30"]), { stdout: (t) => lines.push(t), stderr: (t) => lines.push(t) });
    try {
      expect(watcher.last.ok).toBe(true);
      fs.writeFileSync(path.join(dir, "layout.ts"), "export const TITLE_Y = 0.35;\n");
      await until(() => read("Scene.scene.json").includes("0.35"));
      const good = read("Scene.scene.json");
      fs.writeFileSync(entry, "export function Scene( {");
      await until(() => lines.some((l) => l.includes("Kept the last valid output")));
      expect(read("Scene.scene.json")).toBe(good);
      fs.writeFileSync(entry, SCENE("Fixed"));
      await until(() => read("Scene.scene.json").includes("Fixed"));
    } finally {
      watcher.close();
    }
  });
});
