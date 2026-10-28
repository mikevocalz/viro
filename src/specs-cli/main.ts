import * as fs from "node:fs";
import * as path from "node:path";
import { formatViroSpecsDiagnostic } from "../../components/Specs/core/diagnostic";
import { viroSpecsExitStatus } from "../../components/Specs/core/diagnostics";
import { serializeSpecsManifest } from "../../components/Specs/core/serialize";
import { compileSpecsEntry, compileSpecsManifestFile, type SpecsCompileResult } from "./compile";
import { renderSpecsLensHost } from "./lensTs";

/** Parsed command line of `viro-specs-compile`. */
export interface SpecsCliArgs {
  readonly entry?: string;
  readonly manifest?: string;
  readonly out?: string;
  readonly root?: string;
  readonly format: "json" | "lens-ts";
  readonly strict: boolean;
  readonly diagnosticsFormat: "text" | "json";
}

export const SPECS_CLI_USAGE = [
  "Usage:",
  "  viro-specs-compile --entry scene.tsx --out out.json [--format json|lens-ts] [--strict] [--diagnostics-format text|json] [--root dir]",
  "  viro-specs-compile --manifest scene.json --out out.json [--format json|lens-ts] [--strict] [--diagnostics-format text|json]",
  "",
  "--entry     compile Viro JSX",
  "--manifest  read a hand-written or older manifest (v1 or v2), validate it, and write it as v2",
  "--root      project root for asset IDs (default: nearest package.json above the entry)",
  "--strict    fail on warnings as well as errors (requires viroTag on every element)",
].join("\n");

/** Parses argv, or returns the usage error to print. */
export function parseSpecsCliArgs(argv: readonly string[]): SpecsCliArgs | { readonly error: string } {
  let entry: string | undefined;
  let manifest: string | undefined;
  let out: string | undefined;
  let root: string | undefined;
  let format: string = "json";
  let strict = false;
  let diagnosticsFormat: string = "text";
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = () => argv[++index];
    switch (arg) {
      case "--entry":
        entry = next();
        break;
      case "--manifest":
        manifest = next();
        break;
      case "--out":
        out = next();
        break;
      case "--root":
        root = next();
        break;
      case "--format":
        format = next() ?? "";
        break;
      case "--strict":
        strict = true;
        break;
      case "--diagnostics-format":
        diagnosticsFormat = next() ?? "";
        break;
      default:
        return { error: "Unknown argument " + arg + "\n" + SPECS_CLI_USAGE };
    }
  }
  if ((entry === undefined) === (manifest === undefined) || out === undefined) return { error: SPECS_CLI_USAGE };
  if (format !== "json" && format !== "lens-ts") return { error: "Unknown --format " + format + "\n" + SPECS_CLI_USAGE };
  if (diagnosticsFormat !== "text" && diagnosticsFormat !== "json") {
    return { error: "Unknown --diagnostics-format " + diagnosticsFormat + "\n" + SPECS_CLI_USAGE };
  }
  return {
    ...(entry !== undefined ? { entry } : {}),
    ...(manifest !== undefined ? { manifest } : {}),
    out,
    ...(root !== undefined ? { root } : {}),
    format,
    strict,
    diagnosticsFormat,
  };
}

/** Streams the CLI writes to. Tests pass collectors. */
export interface SpecsCliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const PROCESS_IO: SpecsCliIo = {
  stdout: (text) => process.stdout.write(text + "\n"),
  stderr: (text) => process.stderr.write(text + "\n"),
};

/** Runs `viro-specs-compile` and returns its exit status. Nothing is written when the status is 1. */
export function runSpecsCli(argv: readonly string[], io: SpecsCliIo = PROCESS_IO): 0 | 1 {
  const args = parseSpecsCliArgs(argv);
  if ("error" in args) {
    io.stderr(args.error);
    return 1;
  }
  const input = path.resolve(args.entry ?? args.manifest ?? "");
  const output = path.resolve(args.out ?? "");
  let text: string;
  try {
    text = fs.readFileSync(input, "utf8");
  } catch (error) {
    io.stderr("[viro-specs] Cannot read " + input + ": " + (error instanceof Error ? error.message : String(error)));
    return 1;
  }
  const result: SpecsCompileResult = args.entry
    ? compileSpecsEntry(text, input, args.root !== undefined ? { rootDir: path.resolve(args.root) } : {})
    : compileSpecsManifestFile(text, input);
  const diagnostics = [...result.diagnostics, ...(args.format === "lens-ts" ? result.loweringDiagnostics : [])];

  if (args.diagnosticsFormat === "json") {
    if (diagnostics.length) io.stderr(JSON.stringify(diagnostics, null, 2));
  } else {
    for (const diagnostic of diagnostics) io.stderr("[viro-specs] " + formatViroSpecsDiagnostic(diagnostic));
  }

  const status = result.manifest && result.scene ? viroSpecsExitStatus(diagnostics, args.strict) : 1;
  if (status !== 0 || !result.manifest || !result.scene) {
    // In JSON mode stderr carries only the diagnostics array, for tooling.
    if (args.diagnosticsFormat === "text") {
      io.stderr(
        "[viro-specs] Refusing to write " + path.relative(process.cwd(), output) + (args.strict ? " (--strict: warnings are errors)." : ".")
      );
    }
    return 1;
  }

  const content =
    args.format === "lens-ts"
      ? renderSpecsLensHost({ manifest: result.manifest, scene: result.scene })
      : serializeSpecsManifest(result.manifest);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // Write next to the target and rename, so a reader never sees a partial file.
  const temporary = output + ".tmp-" + process.pid;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, output);
  io.stdout((args.format === "lens-ts" ? "Wrote generated Lens Studio host: " : "Wrote SPECS manifest v2: ") + output);
  return 0;
}
