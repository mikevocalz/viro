#!/usr/bin/env node
// Installs the packed @reactvision/react-viro tarball into a throwaway app
// with npm --strict-peer-deps (no workspace links, no file: dependencies on
// this checkout) and checks the Specs path the way an outside developer uses
// it:
//
//   - peers resolve strictly against the React / React Native versions this
//     repo builds with, and the app ends up with exactly one React
//   - the package entry, types and both bins resolve from node_modules
//   - __test__/fixtures/specs/consumer/ConsumerScene.tsx, which imports only
//     from "@reactvision/react-viro", type-checks against the packed .d.ts
//   - the installed viro-specs-compile compiles that scene with --strict to a
//     manifest, a scene document and a lens-ts host with zero diagnostics,
//     and the Lens output imports nothing from React or React Native
//   - with --specs-tarballs, the @viro-external/specs and xr-contract
//     tarballs install next to it and `viro-specs sync` / `viro-specs test`
//     run from the installed packages
//
// Usage:
//   node scripts/check-specs-consumer.cjs --viro-tarball <tgz>
//     [--specs-tarballs <dir with viro-external-*.tgz>] [--out <dir>] [--keep]
// Without --viro-tarball it runs `npm pack` first.
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repo = path.resolve(__dirname, "..");
const fixture = path.join(repo, "__test__", "fixtures", "specs", "consumer");
const FORBIDDEN = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'](react|react-native|react-dom|@react-native\/[^"']*)(?:\/[^"']*)?["']/;

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const keep = process.argv.includes("--keep");
const specsTarballs = option("--specs-tarballs") ? path.resolve(option("--specs-tarballs")) : undefined;
let viroTarball = option("--viro-tarball") ? path.resolve(option("--viro-tarball")) : undefined;
const out = option("--out") ? path.resolve(option("--out")) : fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-app-"));

if (!viroTarball) {
  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "viro-pack-"));
  const name = execFileSync("npm", ["pack", "--silent", "--pack-destination", packDir], { cwd: repo, encoding: "utf8" }).trim().split("\n").pop();
  viroTarball = path.join(packDir, name);
}

const repoManifest = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
const dev = repoManifest.devDependencies;
const results = [];
function check(name, fn) {
  try {
    results.push({ name, ok: true, detail: fn() ?? "" });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else list.push(full);
  }
  return list;
}

// --- the consumer app -------------------------------------------------------
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
fs.copyFileSync(path.join(fixture, "ConsumerScene.tsx"), path.join(out, "ConsumerScene.tsx"));
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({ name: "viro-specs-app-fixture", private: true, version: "0.0.0" }, null, 2) + "\n");
fs.writeFileSync(
  path.join(out, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "ESNext", moduleResolution: "bundler", customConditions: ["react-native"],
      jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true, types: [],
    },
    files: ["ConsumerScene.tsx", "assets.d.ts"],
  }, null, 2) + "\n",
);
fs.writeFileSync(path.join(out, "assets.d.ts"), 'declare function require(id: string): number;\n');

const installArgs = [
  "install", "--strict-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund",
  viroTarball,
  `react@${dev.react}`,
  `react-native@${dev["react-native"]}`,
  `@types/react@${dev["@types/react"]}`,
];
if (specsTarballs) {
  for (const file of fs.readdirSync(specsTarballs).filter((name) => /^viro-external-(specs|xr-contract)-.*\.tgz$/.test(name))) {
    installArgs.push(path.join(specsTarballs, file));
  }
}
console.log(`consumer: ${out}`);
console.log(`npm ${installArgs.map((arg) => (arg.startsWith("/") ? path.basename(arg) : arg)).join(" ")}`);
const install = spawnSync("npm", installArgs, { cwd: out, encoding: "utf8" });
console.log(`npm install exit ${install.status}`);
process.stdout.write(install.stdout);
if (install.status !== 0) {
  process.stderr.write(install.stderr);
  process.exit(1);
}

const modules = path.join(out, "node_modules");
const viroDir = path.join(modules, "@reactvision", "react-viro");
const viroManifest = JSON.parse(fs.readFileSync(path.join(viroDir, "package.json"), "utf8"));
fs.copyFileSync(path.join(viroDir, "examples", "visionos-sweep", "assets", "shiba.glb"), path.join(out, "assets", "model.glb"));

check("installed package is a copy with publishable ranges", () => {
  assert(!fs.lstatSync(viroDir).isSymbolicLink(), `${viroDir} is a symlink`);
  for (const field of ["dependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(viroManifest[field] ?? {})) {
      assert(!/^(workspace:|file:|link:)/.test(String(range)), `${field}.${name} is ${range}`);
    }
  }
  assert(!("react" in (viroManifest.dependencies ?? {})), `react is a dependency (${viroManifest.dependencies.react}); it must only be a peer`);
  return `${viroManifest.name}@${viroManifest.version}`;
});

check("the app has exactly one React", () => {
  const copies = walk(modules).filter((file) => /[\\/]node_modules[\\/]react[\\/]package\.json$/.test(file));
  assert(copies.length === 1, copies.map((file) => path.relative(out, file)).join(", "));
  return `react ${JSON.parse(fs.readFileSync(copies[0], "utf8")).version}`;
});

check("entry, types and bins resolve from node_modules", () => {
  const entry = require.resolve("@reactvision/react-viro", { paths: [out] });
  assert(entry.startsWith(viroDir), `resolved ${entry}`);
  assert(fs.existsSync(path.join(viroDir, viroManifest.types)), `types ${viroManifest.types} missing`);
  for (const bin of Object.keys(viroManifest.bin)) {
    assert(fs.existsSync(path.join(modules, ".bin", bin)), `node_modules/.bin/${bin} missing`);
  }
  assert(fs.existsSync(path.join(viroDir, "bin", "specs-build", "src", "specs-cli", "main.js")), "bin/specs-build was not packed");
  return `${path.relative(out, entry)}; types ${viroManifest.types}; bins ${Object.keys(viroManifest.bin).join(", ")}`;
});

check("ConsumerScene.tsx type-checks against the packed declarations", () => {
  const tsc = path.join(repo, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, ["-p", "tsconfig.json"], { cwd: out, encoding: "utf8" });
  assert(result.status === 0, `tsc exit ${result.status}\n${result.stdout}${result.stderr}`);
  return "tsc exit 0 (strict, react-native condition)";
});

const compiler = path.join(modules, ".bin", "viro-specs-compile");
const outputs = {};
for (const format of ["json", "scene-json", "lens-ts"]) {
  check(`installed viro-specs-compile --strict --format ${format}`, () => {
    const file = path.join(out, "build", `scene.${format === "lens-ts" ? "ts" : format + ".json"}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const result = spawnSync(compiler, ["--entry", "ConsumerScene.tsx", "--out", file, "--format", format, "--strict", "--diagnostics-format", "json"], { cwd: out, encoding: "utf8" });
    assert(result.status === 0, `exit ${result.status}\n${result.stdout}${result.stderr}`);
    assert(fs.existsSync(file), `${file} was not written`);
    outputs[format] = fs.readFileSync(file, "utf8");
    return `exit 0, ${outputs[format].length} bytes`;
  });
}

check("the Lens host output imports nothing from React or React Native", () => {
  assert(typeof outputs["lens-ts"] === "string", "no lens-ts output");
  assert(!FORBIDDEN.test(outputs["lens-ts"]), "lens-ts output imports React or React Native");
  const manifest = JSON.parse(outputs.json);
  const ids = manifest.nodes.map((node) => node.id);
  for (const id of ["consumer-root", "consumer-title", "consumer-model", "consumer-next"]) {
    assert(ids.includes(id), `manifest lacks node ${id} (has ${ids.join(", ")})`);
  }
  return `nodes ${ids.join(", ")}`;
});

if (specsTarballs) {
  const viroSpecs = path.join(modules, ".bin", "viro-specs");
  check("viro-specs test runs the installed @viro-external/specs validator", () => {
    const result = spawnSync(viroSpecs, ["test"], { cwd: out, encoding: "utf8" });
    assert(result.status === 0, `exit ${result.status}\n${result.stdout}${result.stderr}`);
    return result.stdout.trim();
  });
  check("viro-specs sync copies the production Lens runtime, free of React", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-app-lens-"));
    fs.mkdirSync(path.join(project, "Assets"));
    fs.mkdirSync(path.join(project, "Packages"));
    fs.writeFileSync(path.join(project, "App.esproj"), "studioVersion:\n  major: 5\n  minor: 24\n  patch: 0\ntargetPlatform: Spectacles\n");
    const result = spawnSync(viroSpecs, ["sync", "--project", project], { cwd: out, encoding: "utf8" });
    assert(result.status === 0, `exit ${result.status}\n${result.stdout}${result.stderr}`);
    const lensFiles = walk(path.join(project, "Assets")).filter((file) => file.endsWith(".ts"));
    const offenders = lensFiles.filter((file) => FORBIDDEN.test(fs.readFileSync(file, "utf8")));
    assert(lensFiles.length > 0, "sync copied no .ts files");
    assert(offenders.length === 0, offenders.join(", "));
    fs.rmSync(project, { recursive: true, force: true });
    return `${lensFiles.length} Lens files synced, none import React`;
  });
}

if (!keep && !option("--out")) fs.rmSync(out, { recursive: true, force: true });

let failed = 0;
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.detail ? "\n     " + String(result.detail).split("\n").join("\n     ") : ""}`);
  if (!result.ok) failed++;
}
console.log(`${results.length - failed}/${results.length} consumer checks passed`);
process.exit(failed === 0 ? 0 : 1);
