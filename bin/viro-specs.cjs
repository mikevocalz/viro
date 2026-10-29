#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const path = require("node:path");

const requireFromCwd = createRequire(path.join(process.cwd(), "package.json"));
const command = process.argv[2];

if (command === "compile") {
  const compiler = path.join(__dirname, "viro-specs-compile.cjs");
  const result = spawnSync(process.execPath, [compiler, ...process.argv.slice(3)], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}
if (command === "watch") {
  let watch;
  try {
    watch = require("./specs-build/src/specs-cli/watch.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND" && String(error.message).includes("specs-build")) {
      console.error("viro-specs watch: bin/specs-build is missing. Run `npm run build:specs-cli` in the react-viro package.");
      process.exit(1);
    }
    throw error;
  }
  const io = { stdout: (text) => process.stdout.write(text + "\n"), stderr: (text) => process.stderr.write(text + "\n") };
  const status = watch.runSpecsWatchCli(process.argv.slice(3), io);
  if (status !== "watching") process.exit(status);
  return;
}
// `init <dir>` creates a starter app. `init --project <lens project>` is the
// older Platform Lab bootstrap from @viro-external/specs, now also `lab`.
if (command === "init" && !process.argv.slice(3).includes("--project")) {
  let init;
  try {
    init = require("./specs-build/src/specs-cli/init.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND" && String(error.message).includes("specs-build")) {
      console.error("viro-specs init: bin/specs-build is missing. Run `npm run build:specs-cli` in the react-viro package.");
      process.exit(1);
    }
    throw error;
  }
  const io = { stdout: (text) => process.stdout.write(text + "\n"), stderr: (text) => process.stderr.write(text + "\n") };
  process.exit(init.runSpecsInit(process.argv.slice(3), io));
}
const args = process.argv.slice(3);

const scriptByCommand = {
  init: "bootstrap-platform-lab.mjs",
  lab: "bootstrap-platform-lab.mjs",
  sync: "sync-lens-runtime.mjs",
  doctor: "doctor-lens-project.mjs",
  test: "validate-lens-runtime.mjs",
  go: "go-clad.mjs",
};

if (!command || !scriptByCommand[command]) {
  console.error(
    [
      "Usage: viro-specs <init|compile|watch|sync|doctor|test|lab|go> [args]",
      "",
      "Examples:",
      "  viro-specs init my-specs-app",
      '  viro-specs watch --entry App.tsx --out-dir "/path/to/LensProject/Assets/ViroSpecs/generated"',
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
