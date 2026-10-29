import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { formatViroSpecsDiagnostic } from "../../components/Specs/core/diagnostic";
import { renderStarterFiles, STARTER_ENTRY, type StarterFile } from "./starterTemplates";
import { buildSpecsWatchOutputs } from "./watch";

/** Parsed command line of `viro-specs init`. */
export interface SpecsInitArgs {
  /** Directory the app is created in. */
  readonly dir: string;
  /**
   * Existing Lens Studio project to sync into, instead of the `lens/` folder
   * inside the app. Must already contain `Assets/`.
   */
  readonly lensProject?: string;
  /** Skip the package install. The Lens runtime is then synced only when `@viro-external/specs` resolves from the current directory or next to react-viro. */
  readonly install: boolean;
  /** Write into a non-empty directory, replacing the starter's own files. */
  readonly force: boolean;
}

export const SPECS_INIT_USAGE = [
  "Usage:",
  "  viro-specs init <dir> [--lens-project <path>] [--no-install] [--force]",
  "",
  "Creates an Expo app whose scene (src/HelloScene.tsx) compiles for SPECS with --strict,",
  "syncs the Lens runtime from @viro-external/specs, and writes the generated Lens host.",
  "",
  "--lens-project  existing Lens Studio project (with Assets/) to sync into; default <dir>/lens",
  "--no-install    do not run the package install",
  "--force         write into a non-empty <dir>; replaces only the files init writes",
].join("\n");

/** Parses argv (after `init`), or returns the usage error to print. */
export function parseSpecsInitArgs(argv: readonly string[]): SpecsInitArgs | { readonly error: string } {
  let dir: string | undefined;
  let lensProject: string | undefined;
  let install = true;
  let force = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--lens-project") {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--")) return { error: "--lens-project needs a path.\n" + SPECS_INIT_USAGE };
      lensProject = value;
    } else if (arg === "--no-install") install = false;
    else if (arg === "--force") force = true;
    else if (arg.startsWith("-")) return { error: "Unknown argument " + arg + "\n" + SPECS_INIT_USAGE };
    else if (dir === undefined) dir = arg;
    else return { error: "Unexpected argument " + arg + "\n" + SPECS_INIT_USAGE };
  }
  if (dir === undefined) return { error: SPECS_INIT_USAGE };
  return { dir, ...(lensProject !== undefined ? { lensProject } : {}), install, force };
}

/** Streams init writes to. Tests pass collectors. */
export interface SpecsInitIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

/** Where things come from. Tests override the package lookups. */
export interface SpecsInitEnvironment {
  /** Directory of the react-viro package whose versions the starter depends on. Default: the package this file ships in. */
  readonly viroRoot?: string;
  /** Working directory for relative paths. Default: `process.cwd()`. */
  readonly cwd?: string;
  /** Command the install step runs, as [program, ...args]. Default: the package manager that launched init, else npm. */
  readonly installCommand?: readonly string[];
}

interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

const VIRO_PACKAGE = "@reactvision/react-viro";
const SPECS_PACKAGE = "@viro-external/specs";
const CONTRACT_PACKAGE = "@viro-external/xr-contract";

function readManifest(file: string): PackageManifest {
  return JSON.parse(fs.readFileSync(file, "utf8")) as PackageManifest;
}

/** The react-viro package root above this file (src/specs-cli in a checkout, bin/specs-build/src/specs-cli when built). */
function findViroRoot(): string {
  let dir = __dirname;
  for (;;) {
    const file = path.join(dir, "package.json");
    if (fs.existsSync(file) && readManifest(file).name === VIRO_PACKAGE) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Cannot find the " + VIRO_PACKAGE + " package.json above " + __dirname);
    dir = parent;
  }
}

/** Resolves `@viro-external/specs/package.json` from the first directory that has it. */
function resolveSpecsPackage(searchFrom: readonly string[]): string | undefined {
  for (const dir of searchFrom) {
    try {
      return createRequire(path.join(dir, "package.json")).resolve(SPECS_PACKAGE + "/package.json");
    } catch {
      // Not installed here; try the next directory.
    }
  }
  return undefined;
}

function requireRange(manifest: PackageManifest, field: "peerDependencies" | "devDependencies", name: string): string {
  const range = manifest[field]?.[name];
  if (typeof range !== "string") throw new Error(VIRO_PACKAGE + " package.json has no " + field + "." + name);
  return range;
}

/**
 * Dependency ranges of the starter, taken from react-viro's own package.json
 * so they move with it: react-viro at its version, and every peer the starter
 * uses at react-viro's declared peer range.
 */
export function starterDependencies(viroRoot: string, specsManifestFile?: string): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const viro = readManifest(path.join(viroRoot, "package.json"));
  if (typeof viro.version !== "string") throw new Error(VIRO_PACKAGE + " package.json has no version");
  const specsRange = requireRange(viro, "peerDependencies", SPECS_PACKAGE);
  const contractRange = (specsManifestFile && readManifest(specsManifestFile).peerDependencies?.[CONTRACT_PACKAGE]) || specsRange;
  return {
    dependencies: {
      [VIRO_PACKAGE]: "^" + viro.version,
      [SPECS_PACKAGE]: specsRange,
      [CONTRACT_PACKAGE]: contractRange,
      expo: requireRange(viro, "peerDependencies", "expo"),
      react: requireRange(viro, "peerDependencies", "react"),
      "react-native": requireRange(viro, "peerDependencies", "react-native"),
    },
    devDependencies: {
      "@types/react": requireRange(viro, "devDependencies", "@types/react"),
      typescript: requireRange(viro, "devDependencies", "typescript"),
    },
  };
}

/** npm package name from a directory name: lowercase, `-` for anything npm rejects. */
export function starterPackageName(dir: string): string {
  const name = path
    .basename(path.resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[-]+$/g, "");
  return name || "viro-specs-app";
}

function defaultInstallCommand(): string[] {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm/")) return ["pnpm", "install"];
  if (agent.startsWith("yarn/")) return ["yarn", "install"];
  if (agent.startsWith("bun/")) return ["bun", "install"];
  return ["npm", "install", "--no-audit", "--no-fund"];
}

/** Entries that do not make a directory "non-empty" for init. */
const IGNORED_ENTRIES = new Set([".git", ".DS_Store"]);

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

/**
 * Runs `viro-specs init` and returns its exit status.
 *
 * Order: refuse or validate before writing anything; write the app; install;
 * sync the Lens runtime; compile the scene to the generated Lens host. A
 * second run on the same directory without `--force` exits 1 and changes
 * nothing.
 */
export function runSpecsInit(argv: readonly string[], io: SpecsInitIo, environment: SpecsInitEnvironment = {}): 0 | 1 {
  const args = parseSpecsInitArgs(argv);
  if ("error" in args) {
    io.stderr(args.error);
    return 1;
  }
  const cwd = environment.cwd ?? process.cwd();
  const appDir = path.resolve(cwd, args.dir);
  const lensDir = args.lensProject !== undefined ? path.resolve(cwd, args.lensProject) : path.join(appDir, "lens");

  if (fs.existsSync(appDir)) {
    if (!fs.statSync(appDir).isDirectory()) {
      io.stderr("[viro-specs init] " + appDir + " exists and is not a directory.");
      return 1;
    }
    const entries = fs.readdirSync(appDir).filter((name) => !IGNORED_ENTRIES.has(name));
    if (entries.length > 0 && !args.force) {
      io.stderr(
        "[viro-specs init] " + appDir + " is not empty (" + entries.slice(0, 5).join(", ") + (entries.length > 5 ? ", ..." : "") + "). " +
          "Nothing was written. Pick an empty directory, or pass --force to replace the starter's files in it."
      );
      return 1;
    }
  }
  if (args.lensProject !== undefined && !fs.existsSync(path.join(lensDir, "Assets"))) {
    io.stderr(
      "[viro-specs init] --lens-project " + lensDir + " has no Assets/ folder. Create and save the project in Lens Studio first, " +
        "or leave out --lens-project to use <dir>/lens. Nothing was written."
    );
    return 1;
  }

  let viroRoot: string;
  let files: readonly StarterFile[];
  const specsSearch = [appDir, cwd];
  try {
    viroRoot = environment.viroRoot ?? findViroRoot();
    specsSearch.push(viroRoot);
    const ranges = starterDependencies(viroRoot, resolveSpecsPackage(specsSearch));
    const appName = starterPackageName(appDir);
    files = renderStarterFiles({
      appName,
      displayName: appName,
      lensProject: toPosix(path.relative(appDir, lensDir)) || ".",
      ...ranges,
    });
  } catch (error) {
    io.stderr("[viro-specs init] " + (error instanceof Error ? error.message : String(error)));
    return 1;
  }

  for (const file of files) {
    const target = path.join(appDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  fs.mkdirSync(path.join(lensDir, "Assets"), { recursive: true });
  io.stdout("Created " + appDir);
  for (const file of files) io.stdout("  " + file.path);

  if (args.install) {
    const [program, ...installArgs] = environment.installCommand ?? defaultInstallCommand();
    io.stdout("Installing: " + [program, ...installArgs].join(" "));
    const install = spawnSync(program, installArgs, { cwd: appDir, stdio: "inherit", shell: process.platform === "win32" });
    if (install.status !== 0) {
      io.stderr("[viro-specs init] " + program + " exited " + String(install.status ?? install.error?.message) + ". Fix the install, then run npm run lens:sync and npm run lens:host.");
      return 1;
    }
  }

  const lensLabel = toPosix(path.relative(cwd, lensDir)) || ".";
  const specsManifest = resolveSpecsPackage(specsSearch);
  if (specsManifest) {
    const script = path.join(path.dirname(specsManifest), "scripts", "sync-lens-runtime.mjs");
    io.stdout("Syncing the Lens runtime from " + path.dirname(specsManifest) + " into " + lensLabel);
    const sync = spawnSync(process.execPath, [script, "--project", lensDir], { cwd: appDir, encoding: "utf8" });
    if (sync.stdout) io.stdout(sync.stdout.trimEnd());
    if (sync.status !== 0) {
      if (sync.stderr) io.stderr(sync.stderr.trimEnd());
      io.stderr("[viro-specs init] Lens runtime sync failed (exit " + String(sync.status) + ").");
      return 1;
    }
  } else {
    io.stdout(
      "Lens runtime not synced: " + SPECS_PACKAGE + " is not installed. After npm install, run npm run lens:sync."
    );
  }

  const build = buildSpecsWatchOutputs({
    entry: path.join(appDir, STARTER_ENTRY),
    outDir: path.join(lensDir, "Assets", "ViroSpecs", "generated"),
    formats: ["lens-ts"],
    root: appDir,
    strict: true,
    once: true,
    debounceMs: 0,
    forceOverwrite: [],
  });
  for (const diagnostic of build.diagnostics) io.stderr("[viro-specs] " + formatViroSpecsDiagnostic(diagnostic));
  if (!build.ok) {
    io.stderr("[viro-specs init] The starter scene did not compile: " + build.reason + ".");
    return 1;
  }
  for (const outcome of build.files) {
    io.stdout("Generated Lens host (" + outcome.status + "): " + lensLabel + "/Assets/ViroSpecs/generated/" + outcome.name);
  }

  const relativeApp = toPosix(path.relative(cwd, appDir)) || ".";
  io.stdout(
    [
      "",
      "Next:",
      "  cd " + relativeApp,
      ...(args.install ? [] : ["  npm install"]),
      ...(specsManifest ? [] : ["  npm run lens:sync"]),
      "  npm run specs:check",
      "  See README.md for the Lens Studio steps.",
    ].join("\n")
  );
  return 0;
}
