#!/usr/bin/env node
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

function usage() {
  console.log(`
Viro SPECS CLI

Usage:
  viro specs doctor --project /path/to/LensProject
  viro specs sync --project /path/to/LensProject
  viro specs init --project /path/to/LensProject
  viro specs test [--project /path/to/LensProject]
  viro specs go --project /path/to/LensProject
  viro specs platform-lab --project /path/to/LensProject

Colon aliases are also supported:
  viro specs:doctor ...
  viro specs:sync ...
  viro specs:init ...
  viro specs:test ...
  viro specs:go ...
  viro specs:platform-lab ...
`);
}

function resolveSpecsRoot() {
  try {
    return dirname(
      require.resolve("@viro-external/specs/package.json", {
        paths: [process.cwd()],
      })
    );
  } catch {
    console.error(
      [
        "[Viro] SPECS backend is not installed.",
        "Install @viro-external/specs in the application/workspace that owns the Lens Studio project.",
        "",
        "  pnpm add -D @viro-external/specs",
      ].join("\n")
    );
    process.exit(2);
  }
}

function scriptPath(root, name) {
  return join(root, "scripts", name);
}

function runScript(root, script, args) {
  const result = spawnSync(process.execPath, [scriptPath(root, script), ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  return result.status ?? 1;
}

let command = process.argv[2];
let args = process.argv.slice(3);

if (command === "specs") {
  command = args.shift();
} else if (command?.startsWith("specs:")) {
  command = command.slice("specs:".length);
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}

const root = resolveSpecsRoot();

switch (command) {
  case "doctor":
    runScript(root, "doctor-lens-project.mjs", args);
    break;
  case "sync":
    runScript(root, "sync-lens-runtime.mjs", args);
    break;
  case "init":
    runScript(root, "bootstrap-platform-lab.mjs", args);
    break;
  case "go":
    runScript(root, "go-clad.mjs", args);
    break;
  case "platform-lab":
    runScript(
      root,
      "go-clad.mjs",
      args.includes("--exec") ? args : [...args, "--exec"]
    );
    break;
  case "test": {
    const first = runScript(root, "validate-lens-runtime.mjs", []);
    if (first !== 0) break;
    runScript(root, "go-clad.test.mjs", []);
    break;
  }
  default:
    console.error(`Unknown Viro SPECS command: ${command}`);
    usage();
    process.exitCode = 2;
}
