/**
 * `viro-specs init`: the starter app it writes, the refusal on a non-empty
 * directory, `--force`, `--lens-project`, the Lens runtime sync hand-off, and
 * that the generated scene compiles with the installed-style CLI under
 * --strict with no diagnostics and no React in the Lens output.
 *
 * The CLI runs from bin/ the way node_modules/.bin runs it, so
 * `npm run build:specs-cli` must have run (test:specs-compiler and CI do).
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseSpecsInitArgs, starterPackageName } from "../src/specs-cli/init";

const repo = path.resolve(__dirname, "..");
const viroSpecs = path.join(repo, "bin", "viro-specs.cjs");
const compiler = path.join(repo, "bin", "viro-specs-compile.cjs");
const viroManifest = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
const FORBIDDEN = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'](react|react-native|react-dom|@react-native\/[^"']*)(?:\/[^"']*)?["']/;

const STARTER_FILES = [
  ".gitignore",
  "App.tsx",
  "README.md",
  "app.json",
  "index.ts",
  "lens/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts",
  "lens/Assets/ViroSpecs/generated/viro-specs.generated.json",
  "package.json",
  "scripts/lens.mjs",
  "src/HelloScene.tsx",
  "src/phoneTransport.ts",
  "tsconfig.json",
];

let tmp: string;

function run(script: string, args: string[], cwd = tmp) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

function snapshot(dir: string): Record<string, string> {
  return Object.fromEntries(listFiles(dir).map((file) => [file, fs.readFileSync(path.join(dir, file), "utf8")]));
}

beforeAll(() => {
  if (!fs.existsSync(path.join(repo, "bin", "specs-build", "src", "specs-cli", "init.js"))) {
    throw new Error("bin/specs-build/src/specs-cli/init.js is missing. Run `npm run build:specs-cli` first.");
  }
});

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-init-")));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("parseSpecsInitArgs", () => {
  it("reads the directory and options", () => {
    expect(parseSpecsInitArgs(["app", "--no-install", "--force", "--lens-project", "../Lens"])).toEqual({
      dir: "app",
      lensProject: "../Lens",
      install: false,
      force: true,
    });
    expect(parseSpecsInitArgs(["app"])).toEqual({ dir: "app", install: true, force: false });
  });

  it("rejects a missing directory, unknown flags, a second directory and a valueless --lens-project", () => {
    expect(parseSpecsInitArgs([])).toHaveProperty("error");
    expect(parseSpecsInitArgs(["app", "--yes"])).toHaveProperty("error");
    expect(parseSpecsInitArgs(["app", "other"])).toHaveProperty("error");
    expect(parseSpecsInitArgs(["app", "--lens-project"])).toHaveProperty("error");
    expect(parseSpecsInitArgs(["app", "--lens-project", "--force"])).toHaveProperty("error");
  });

  it("derives an npm name from the directory", () => {
    expect(starterPackageName("/x/My Specs App")).toBe("my-specs-app");
    expect(starterPackageName("/x/.hidden")).toBe("hidden");
  });
});

describe("viro-specs init", () => {
  it("writes the starter, and its scene compiles with --strict to json, scene-json and lens-ts with no diagnostics", () => {
    const init = run(viroSpecs, ["init", "hello-app", "--no-install"]);
    expect(init.stderr).toBe("");
    expect(init.status).toBe(0);
    const app = path.join(tmp, "hello-app");
    expect(listFiles(app)).toEqual(STARTER_FILES);

    const pkg = JSON.parse(fs.readFileSync(path.join(app, "package.json"), "utf8"));
    expect(pkg.name).toBe("hello-app");
    expect(pkg.dependencies).toEqual({
      "@reactvision/react-viro": "^" + viroManifest.version,
      "@viro-external/specs": viroManifest.peerDependencies["@viro-external/specs"],
      "@viro-external/xr-contract": viroManifest.peerDependencies["@viro-external/specs"],
      expo: viroManifest.peerDependencies.expo,
      react: viroManifest.peerDependencies.react,
      "react-native": viroManifest.peerDependencies["react-native"],
    });
    for (const range of Object.values<string>({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(range).not.toMatch(/^(workspace:|file:|link:)/);
    }
    expect(pkg.viroSpecs).toEqual({ lensProject: "lens", entry: "src/HelloScene.tsx" });

    const outputs: Record<string, string> = {};
    for (const format of ["json", "scene-json", "lens-ts"]) {
      const out = path.join(app, "build", "hello." + format);
      const compiled = run(compiler, ["--entry", "src/HelloScene.tsx", "--out", out, "--format", format, "--strict", "--diagnostics-format", "json"], app);
      expect({ format, status: compiled.status, stderr: compiled.stderr }).toEqual({ format, status: 0, stderr: "" });
      outputs[format] = fs.readFileSync(out, "utf8");
    }
    expect(FORBIDDEN.test(outputs["lens-ts"])).toBe(false);
    expect(outputs["lens-ts"]).toContain("export class ViroGeneratedSceneHost");
    const ids = JSON.parse(outputs.json).nodes.map((node: { id: string }) => node.id);
    expect(ids).toEqual(expect.arrayContaining(["hello-root", "hello-title", "hello-body", "hello-next"]));

    // lens/ is not a Lens Studio project until one is saved; doctor says so instead of failing on a missing .esproj.
    const doctor = run(path.join(app, "scripts", "lens.mjs"), ["doctor"], app);
    expect(doctor.status).toBe(1);
    expect(doctor.stderr).toMatch(/lens is not a Lens Studio project yet \(no \.esproj file\)/);

    // The host init wrote is the one the CLI compiles.
    expect(fs.readFileSync(path.join(app, "lens/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts"), "utf8")).toBe(outputs["lens-ts"]);
  });

  it("refuses a non-empty directory and changes nothing", () => {
    expect(run(viroSpecs, ["init", "hello-app", "--no-install"]).status).toBe(0);
    const app = path.join(tmp, "hello-app");
    fs.writeFileSync(path.join(app, "src", "HelloScene.tsx"), "// my edit\n");
    const before = snapshot(app);

    const again = run(viroSpecs, ["init", "hello-app", "--no-install"]);
    expect(again.status).toBe(1);
    expect(again.stderr).toMatch(/is not empty .*Nothing was written/);
    expect(snapshot(app)).toEqual(before);

    const other = path.join(tmp, "other");
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, "notes.txt"), "keep\n");
    expect(run(viroSpecs, ["init", "other", "--no-install"]).status).toBe(1);
    expect(listFiles(other)).toEqual(["notes.txt"]);
  });

  it("--force writes into a non-empty directory and keeps files it does not own", () => {
    const app = path.join(tmp, "hello-app");
    fs.mkdirSync(app);
    fs.writeFileSync(path.join(app, "notes.txt"), "keep\n");
    const forced = run(viroSpecs, ["init", "hello-app", "--no-install", "--force"]);
    expect(forced.status).toBe(0);
    expect(fs.readFileSync(path.join(app, "notes.txt"), "utf8")).toBe("keep\n");
    expect(listFiles(app)).toEqual([...STARTER_FILES, "notes.txt"].sort());
    expect(run(viroSpecs, ["init", "hello-app", "--no-install", "--force"]).stdout).toMatch(/Generated Lens host \(unchanged\)/);
  });

  it("--lens-project needs an existing project with Assets/, and the app points at it", () => {
    const missing = run(viroSpecs, ["init", "hello-app", "--no-install", "--lens-project", "Lens"]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/has no Assets\/ folder/);
    expect(fs.existsSync(path.join(tmp, "hello-app"))).toBe(false);

    fs.mkdirSync(path.join(tmp, "Lens", "Assets"), { recursive: true });
    expect(run(viroSpecs, ["init", "hello-app", "--no-install", "--lens-project", "Lens"]).status).toBe(0);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "hello-app", "package.json"), "utf8"));
    expect(pkg.viroSpecs.lensProject).toBe("../Lens");
    expect(fs.existsSync(path.join(tmp, "Lens/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "hello-app", "lens"))).toBe(false);
  });

  it("syncs the Lens runtime with the @viro-external/specs it finds, then writes the host", () => {
    // A stand-in package whose sync script records its arguments.
    const specs = path.join(tmp, "node_modules", "@viro-external", "specs");
    fs.mkdirSync(path.join(specs, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(specs, "package.json"), JSON.stringify({ name: "@viro-external/specs", version: "0.3.0", peerDependencies: { "@viro-external/xr-contract": "^0.3.1" } }));
    fs.writeFileSync(
      path.join(specs, "scripts", "sync-lens-runtime.mjs"),
      'import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[3] + "/Assets/synced.txt", process.argv.slice(2).join(" "));\nconsole.log("stub sync ok");\n'
    );
    const init = run(viroSpecs, ["init", "hello-app", "--no-install"]);
    expect(init.status).toBe(0);
    expect(init.stdout).toMatch(/stub sync ok/);
    const lens = path.join(tmp, "hello-app", "lens");
    expect(fs.readFileSync(path.join(lens, "Assets", "synced.txt"), "utf8")).toBe("--project " + lens);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "hello-app", "package.json"), "utf8"));
    expect(pkg.dependencies["@viro-external/xr-contract"]).toBe("^0.3.1");

    fs.writeFileSync(path.join(specs, "scripts", "sync-lens-runtime.mjs"), 'console.error("boom");\nprocess.exit(3);\n');
    const failed = run(viroSpecs, ["init", "second", "--no-install"]);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toMatch(/boom[\s\S]*sync failed \(exit 3\)/);
  });

  it("keeps the Platform Lab bootstrap behind `init --project`", () => {
    const legacy = run(viroSpecs, ["init", "--project", path.join(tmp, "Lens")]);
    // No @viro-external/specs here, so the delegate stops at the install check.
    expect(legacy.status).toBe(1);
    expect(legacy.stderr).toMatch(/The Specs backend is not installed/);
  });
});
