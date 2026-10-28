import * as fs from "node:fs";
import * as path from "node:path";
import { formatViroSpecsDiagnostic, type ViroSpecsDiagnostic } from "../../components/Specs/core/diagnostic";
import { viroSpecsExitStatus } from "../../components/Specs/core/diagnostics";
import { serializeSpecsManifest, serializeSpecsSceneDocument } from "../../components/Specs/core/serialize";
import { compileSpecsEntry, compileSpecsManifestFile } from "./compile";
import { writeGeneratedFiles, type GeneratedFile, type GeneratedFileOutcome } from "./generatedFiles";
import { renderSpecsLensHost } from "./lensTs";
import type { SpecsFileSystem } from "./modules";

/** Output formats `viro-specs watch` can keep current. */
export type SpecsWatchFormat = "json" | "scene-json" | "lens-ts";

/** Parsed command line of `viro-specs watch`. */
export interface SpecsWatchArgs {
  readonly entry?: string;
  readonly manifest?: string;
  readonly outDir: string;
  readonly formats: readonly SpecsWatchFormat[];
  /** Base name of the JSON outputs. @default the input file name without extension */
  readonly name?: string;
  readonly root?: string;
  readonly strict: boolean;
  /** Build once and exit (CI, tests). */
  readonly once: boolean;
  readonly debounceMs: number;
  readonly forceOverwrite: readonly string[];
}

export const SPECS_WATCH_USAGE = [
  "Usage:",
  "  viro-specs watch --entry scene.tsx --out-dir <Lens project>/Assets/ViroSpecs/generated [--format lens-ts,scene-json,json]",
  "                   [--name Scene] [--root dir] [--strict] [--once] [--debounce-ms 120] [--force-overwrite file]...",
  "  viro-specs watch --manifest scene.json --out-dir dir ...",
  "",
  "Rebuilds when the entry or any module it imports changes. Files are written atomically.",
  "A failed build writes nothing, so the last valid output stays in place.",
  "A generated file you edited is kept; pass --force-overwrite <name> to replace it.",
  "Nothing in --out-dir is ever deleted.",
].join("\n");

const FORMATS: readonly SpecsWatchFormat[] = ["json", "scene-json", "lens-ts"];

/** Parses argv, or returns the usage error to print. */
export function parseSpecsWatchArgs(argv: readonly string[]): SpecsWatchArgs | { readonly error: string } {
  let entry: string | undefined;
  let manifest: string | undefined;
  let outDir: string | undefined;
  let formats: SpecsWatchFormat[] = ["lens-ts", "scene-json"];
  let name: string | undefined;
  let root: string | undefined;
  let strict = false;
  let once = false;
  let debounceMs = 120;
  const forceOverwrite: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = (): string | undefined => argv[++index];
    switch (arg) {
      case "--entry":
        entry = next();
        break;
      case "--manifest":
        manifest = next();
        break;
      case "--out-dir":
        outDir = next();
        break;
      case "--format": {
        const list = (next() ?? "").split(",").map((f) => f.trim()).filter(Boolean);
        const bad = list.find((f) => !FORMATS.includes(f as SpecsWatchFormat));
        if (bad !== undefined || list.length === 0) return { error: "Unknown --format " + (bad ?? "(empty)") + "\n" + SPECS_WATCH_USAGE };
        formats = list as SpecsWatchFormat[];
        break;
      }
      case "--name":
        name = next();
        break;
      case "--root":
        root = next();
        break;
      case "--strict":
        strict = true;
        break;
      case "--once":
        once = true;
        break;
      case "--debounce-ms": {
        const value = Number(next());
        if (!Number.isFinite(value) || value < 0) return { error: "--debounce-ms needs a number of milliseconds\n" + SPECS_WATCH_USAGE };
        debounceMs = value;
        break;
      }
      case "--force-overwrite": {
        const value = next();
        if (value === undefined) return { error: "--force-overwrite needs a file name\n" + SPECS_WATCH_USAGE };
        forceOverwrite.push(value);
        break;
      }
      default:
        return { error: "Unknown argument " + arg + "\n" + SPECS_WATCH_USAGE };
    }
  }
  if ((entry === undefined) === (manifest === undefined) || outDir === undefined) return { error: SPECS_WATCH_USAGE };
  return {
    ...(entry !== undefined ? { entry } : {}),
    ...(manifest !== undefined ? { manifest } : {}),
    outDir,
    formats,
    ...(name !== undefined ? { name } : {}),
    ...(root !== undefined ? { root } : {}),
    strict,
    once,
    debounceMs,
    forceOverwrite,
  };
}

/** Result of one build. */
export type SpecsWatchBuild =
  | { readonly ok: true; readonly diagnostics: readonly ViroSpecsDiagnostic[]; readonly files: readonly GeneratedFileOutcome[]; readonly inputs: readonly string[] }
  | { readonly ok: false; readonly diagnostics: readonly ViroSpecsDiagnostic[]; readonly inputs: readonly string[]; readonly reason: string };

/** File names each format writes. */
export function specsWatchFileName(format: SpecsWatchFormat, base: string): string {
  return format === "lens-ts" ? "ViroGeneratedSceneHost.ts" : format === "scene-json" ? base + ".scene.json" : base + ".manifest.json";
}

/**
 * Compiles once and, only when the build is valid, writes every requested
 * format through {@linkcode writeGeneratedFiles}. A failed build writes
 * nothing. `inputs` lists every file the compiler read, which is what a
 * watcher must watch.
 */
export function buildSpecsWatchOutputs(args: SpecsWatchArgs): SpecsWatchBuild {
  const input = path.resolve(args.entry ?? args.manifest ?? "");
  const read = new Set<string>([input]);
  const recording: SpecsFileSystem = {
    readFile: (file) => {
      read.add(path.resolve(file));
      try {
        return fs.readFileSync(file, "utf8");
      } catch {
        return undefined;
      }
    },
    exists: (file) => {
      try {
        return fs.statSync(file).isFile();
      } catch {
        return false;
      }
    },
  };
  let text: string;
  try {
    text = fs.readFileSync(input, "utf8");
  } catch (error) {
    return { ok: false, diagnostics: [], inputs: [...read], reason: "Cannot read " + input + ": " + (error instanceof Error ? error.message : String(error)) };
  }
  const result = args.entry
    ? compileSpecsEntry(text, input, { fs: recording, ...(args.root !== undefined ? { rootDir: path.resolve(args.root) } : {}) })
    : compileSpecsManifestFile(text, input);
  const inputs = [...read].sort();
  const status = result.manifest ? viroSpecsExitStatus(result.diagnostics, args.strict) : 1;
  if (status !== 0 || !result.manifest) {
    return { ok: false, diagnostics: result.diagnostics, inputs, reason: args.strict ? "the build has errors or, with --strict, warnings" : "the build has errors" };
  }
  const base = args.name ?? path.basename(input).replace(/\.[^.]+$/, "");
  const manifest = result.manifest;
  const files: GeneratedFile[] = args.formats.map((format) => ({
    name: specsWatchFileName(format, base),
    content:
      format === "lens-ts" ? renderSpecsLensHost({ manifest }) : format === "scene-json" ? serializeSpecsSceneDocument(manifest) : serializeSpecsManifest(manifest),
  }));
  const outcomes = writeGeneratedFiles(path.resolve(args.outDir), files, { forceOverwrite: args.forceOverwrite, generator: "viro-specs watch" });
  return { ok: true, diagnostics: result.diagnostics, files: outcomes, inputs };
}

/** Streams the watcher writes to. */
export interface SpecsWatchIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

/** A running watcher. */
export interface SpecsWatcher {
  /** The latest build. */
  readonly last: SpecsWatchBuild;
  /** Builds now, outside the debounce. */
  rebuild(): SpecsWatchBuild;
  /** Stops watching. Idempotent. */
  close(): void;
}

/** Prints one build in the CLI's format. */
export function reportSpecsWatchBuild(build: SpecsWatchBuild, io: SpecsWatchIo, keptSince: string | undefined): void {
  for (const d of build.diagnostics) io.stderr("[viro-specs] " + formatViroSpecsDiagnostic(d));
  if (!build.ok) {
    io.stderr("[viro-specs] Build failed: " + build.reason + ". " + (keptSince ? "Kept the last valid output from " + keptSince + "." : "No output written yet."));
    return;
  }
  for (const f of build.files) {
    if (f.status === "kept-user-edit") io.stderr("[viro-specs] Kept " + f.name + ": it was edited after viro-specs wrote it. Pass --force-overwrite " + f.name + " to replace it.");
    else if (f.status === "kept-foreign") io.stderr("[viro-specs] Kept " + f.name + ": viro-specs did not write it. Pass --force-overwrite " + f.name + " to replace it.");
    else io.stdout("[viro-specs] " + f.status + " " + f.name);
  }
}

/**
 * Builds, then rebuilds whenever a file the last build read changes. The
 * parent directories are watched rather than the files, so editors that
 * save by rename are seen. Bursts of events are coalesced over
 * `debounceMs`.
 */
export function startSpecsWatcher(args: SpecsWatchArgs, io: SpecsWatchIo): SpecsWatcher {
  let keptSince: string | undefined;
  let watched = new Map<string, fs.FSWatcher>();
  let inputs = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const run = (): SpecsWatchBuild => {
    const build = buildSpecsWatchOutputs(args);
    reportSpecsWatchBuild(build, io, keptSince);
    if (build.ok) keptSince = new Date().toISOString();
    // Keep the old inputs as well after a failure, so fixing the file that broke the build triggers a rebuild.
    inputs = new Set(build.ok ? build.inputs : [...inputs, ...build.inputs]);
    resubscribe();
    return build;
  };

  const resubscribe = (): void => {
    if (closed) return;
    const dirs = new Set([...inputs].map((f) => path.dirname(f)));
    for (const [dir, watcher] of watched) {
      if (!dirs.has(dir)) {
        watcher.close();
        watched.delete(dir);
      }
    }
    for (const dir of dirs) {
      if (watched.has(dir)) continue;
      try {
        const watcher = fs.watch(dir, (_event, filename) => {
          if (filename !== null && !inputs.has(path.join(dir, filename.toString()))) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = undefined;
            if (!closed) state.last = run();
          }, args.debounceMs);
        });
        watched.set(dir, watcher);
      } catch (error) {
        io.stderr("[viro-specs] Cannot watch " + dir + ": " + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  const state: { last: SpecsWatchBuild } = { last: run() };
  io.stdout("[viro-specs] Watching " + inputs.size + (inputs.size === 1 ? " file" : " files") + ". Press Ctrl+C to stop.");
  return {
    get last() {
      return state.last;
    },
    rebuild() {
      state.last = run();
      return state.last;
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      for (const watcher of watched.values()) watcher.close();
      watched = new Map();
    },
  };
}

/** Entry for `viro-specs watch`. Returns an exit status for `--once`; otherwise runs until interrupted. */
export function runSpecsWatchCli(argv: readonly string[], io: SpecsWatchIo): 0 | 1 | "watching" {
  const args = parseSpecsWatchArgs(argv);
  if ("error" in args) {
    io.stderr(args.error);
    return 1;
  }
  if (args.once) {
    const build = buildSpecsWatchOutputs(args);
    reportSpecsWatchBuild(build, io, undefined);
    return build.ok ? 0 : 1;
  }
  const watcher = startSpecsWatcher(args, io);
  process.once("SIGINT", () => {
    watcher.close();
    process.exit(0);
  });
  return "watching";
}
