#!/usr/bin/env node
// Copies the Lens host core (the files under @viro-external/specs lens/ that use
// no Lens Studio globals) into src/vendor/lens-core, two Lens-only files as
// reference text, and the mock-host test backend; records the source commit
// and a sha256 per file in src/vendor/VENDOR.json.
//
//   node scripts/sync-lens-core.mjs --from /path/to/viro-external
//       copy the files and rewrite VENDOR.json
//   node scripts/sync-lens-core.mjs --check
//       verify the vendored files still match VENDOR.json (no checkout needed)
//   node scripts/sync-lens-core.mjs --check --from /path/to/viro-external
//       also verify they match the checkout byte for byte
//
// The preview runs the real ViroSpecsSceneController against a three.js
// backend, so its ordering, defaults, placeholders and diagnostics are the Lens
// host's. Drift between the copy and viro-external fails --check.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Same list as tsconfig.lens-core.json in @viro-external/specs. */
const CORE = [
  "ViroSpecsProtocol.ts",
  "ViroSpecsHostDiagnostics.ts",
  "ViroSpecsActionContract.ts",
  "ViroSpecsSceneDocument.ts",
  "ViroSpecsSceneBackend.ts",
  "ViroSpecsResourceCache.ts",
  "ViroSpecsSceneController.ts",
  "ViroSpecsActionRuntime.ts",
  "ViroSpecsReferenceFlow.ts",
  "ViroSpecsExperienceTokens.ts",
  "ViroSpecsExperienceCopy.ts",
  "ViroSpecsPlacement.ts",
  "ViroSpecsExperience.ts",
];
/**
 * Lens-only files kept as plain text for test/lensSemantics.test.ts, which
 * reads the unit, text and placeholder constants out of them. Never compiled.
 */
const REFERENCE = ["ViroSpecsLensSceneBackend.ts", "ViroSpecsAnimationRuntime.ts"];
/** The recording backend the viro-external mock-host suite uses. */
const MOCK_HOST = "mock-scene-host.mjs";

/** Vendored name -> { upstream path relative to packages/specs, local path relative to the preview root }. */
const FILES = Object.fromEntries([
  ...CORE.map((f) => [f, { upstream: path.join("lens", f), local: path.join("src", "vendor", "lens-core", f) }]),
  ...REFERENCE.map((f) => [f, { upstream: path.join("lens", f), local: path.join("src", "vendor", "lens-reference", f + ".txt") }]),
  [MOCK_HOST, { upstream: path.join("scripts", "support", MOCK_HOST), local: path.join("test", "vendor", MOCK_HOST) }],
]);

const here = path.dirname(fileURLToPath(import.meta.url));
const previewRoot = path.resolve(here, "..");
const vendorJson = path.join(previewRoot, "src", "vendor", "VENDOR.json");

const argv = process.argv.slice(2);
const check = argv.includes("--check");
const fromIndex = argv.indexOf("--from");
const from = fromIndex >= 0 ? argv[fromIndex + 1] : process.env.VIRO_EXTERNAL_DIR;

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const specsDir = (root) => path.join(root, "packages", "specs");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

async function checkVendored() {
  const failures = [];
  if (!existsSync(vendorJson)) {
    console.error("Missing " + path.relative(process.cwd(), vendorJson) + "; run with --from first.");
    process.exit(1);
  }
  const record = JSON.parse(await readFile(vendorJson, "utf8"));
  for (const [file, where] of Object.entries(FILES)) {
    const entry = record.files[file];
    const local = path.join(previewRoot, where.local);
    if (!entry) failures.push(file + ": not listed in VENDOR.json");
    else if (!existsSync(local)) failures.push(file + ": missing at " + where.local);
    else if (sha256(await readFile(local)) !== entry.sha256) failures.push(file + ": edited after vendoring (sha256 differs from VENDOR.json)");
  }
  if (from) {
    for (const [file, where] of Object.entries(FILES)) {
      const upstream = path.join(specsDir(from), where.upstream);
      if (!existsSync(upstream)) {
        failures.push(file + ": not in " + specsDir(from));
        continue;
      }
      const local = path.join(previewRoot, where.local);
      if (existsSync(local) && sha256(await readFile(upstream)) !== sha256(await readFile(local))) {
        failures.push(file + ": differs from " + from + " (" + git(from, ["rev-parse", "--short", "HEAD"]) + "); re-run with --from");
      }
    }
  }
  if (failures.length) {
    console.error("Vendored Lens core check failed:");
    for (const failure of failures) console.error(" - " + failure);
    process.exit(1);
  }
  console.log("Vendored Lens core matches VENDOR.json (" + record.source.commit + ")" + (from ? " and " + from : "") + ".");
}

async function sync() {
  if (!from) {
    console.error("Pass --from /path/to/viro-external or set VIRO_EXTERNAL_DIR.");
    process.exit(1);
  }
  const files = {};
  for (const [file, where] of Object.entries(FILES)) {
    const source = await readFile(path.join(specsDir(from), where.upstream));
    const local = path.join(previewRoot, where.local);
    await mkdir(path.dirname(local), { recursive: true });
    await writeFile(local, source);
    files[file] = { upstream: "packages/specs/" + where.upstream.split(path.sep).join("/"), local: where.local.split(path.sep).join("/"), sha256: sha256(source) };
  }
  const dirty = git(from, ["status", "--porcelain", "--", "packages/specs/lens", "packages/specs/scripts/support"]) !== "";
  const record = {
    note: "Generated by scripts/sync-lens-core.mjs. Do not edit the vendored files; change them in viro-external and re-sync.",
    source: {
      repository: "mikevocalz/viro-external",
      branch: git(from, ["rev-parse", "--abbrev-ref", "HEAD"]),
      commit: git(from, ["rev-parse", "HEAD"]),
      dirty,
    },
    files,
  };
  await writeFile(vendorJson, JSON.stringify(record, null, 2) + "\n");
  console.log("Vendored " + Object.keys(FILES).length + " files from " + record.source.branch + " @ " + record.source.commit.slice(0, 8) + (dirty ? " (uncommitted changes)" : ""));
}

if (check) await checkVendored();
else await sync();
