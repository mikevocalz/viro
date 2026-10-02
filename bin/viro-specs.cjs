#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const path = require("node:path");

const requireFromCwd = createRequire(path.join(process.cwd(), "package.json"));
const command = process.argv[2];
const args = process.argv.slice(3);

const scriptByCommand = {
  init: "bootstrap-platform-lab.mjs",
  sync: "sync-lens-runtime.mjs",
  doctor: "doctor-lens-project.mjs",
  test: "validate-lens-runtime.mjs",
  go: "go-clad.mjs",
};

if (!command || !scriptByCommand[command]) {
  console.error(
    [
      "Usage: viro-specs <init|sync|doctor|test|go> [args]",
      "",
      "Examples:",
      '  viro-specs doctor --project "/path/to/LensProject"',
      '  viro-specs sync --project "/path/to/LensProject" --clean',
      '  viro-specs go --project "/path/to/LensProject" --exec',
    ].join("\n")
  );
  process.exit(1);
}

let packageJson;
try {
  packageJson = requireFromCwd.resolve("@viro-external/specs/package.json");
} catch {
  console.error(
    [
      "The Specs backend is not installed.",
      "Add @viro-external/specs to this project, then rerun viro-specs.",
    ].join("\n")
  );
  process.exit(1);
}

const script = path.join(
  path.dirname(packageJson),
  "scripts",
  scriptByCommand[command]
);

const result = spawnSync(process.execPath, [script, ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
