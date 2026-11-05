import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** Ledger file `viro-specs watch` keeps in its output directory. */
export const GENERATED_LEDGER_NAME = "viro-specs.generated.json";

/** What the SDK wrote, by path relative to the output directory. */
export interface GeneratedLedger {
  readonly schemaVersion: 1;
  readonly generator: string;
  readonly files: Readonly<Record<string, { readonly sha256: string }>>;
}

/** One file to write. `name` is relative to the output directory and uses `/`. */
export interface GeneratedFile {
  readonly name: string;
  readonly content: string;
}

/** What happened to one file. */
export type GeneratedFileOutcome =
  /** Did not exist; written. */
  | { readonly name: string; readonly status: "created" }
  /** SDK-owned and unedited; replaced in place (same path, so its Lens .meta and asset UUID stay). */
  | { readonly name: string; readonly status: "updated" }
  /** Content identical; not touched, so Lens Studio does not reimport it. */
  | { readonly name: string; readonly status: "unchanged" }
  /** The file differs from what the SDK last wrote: a user edit. Kept as is. */
  | { readonly name: string; readonly status: "kept-user-edit" }
  /** A file the SDK never wrote is at this path. Kept as is. */
  | { readonly name: string; readonly status: "kept-foreign" }
  /** A user-edited or foreign file replaced because the caller named it in `forceOverwrite`. */
  | { readonly name: string; readonly status: "overwritten" };

/** Options for {@linkcode writeGeneratedFiles}. */
export interface WriteGeneratedFilesOptions {
  /** Names to replace even when edited or foreign. */
  readonly forceOverwrite?: readonly string[];
  /** Recorded in the ledger. */
  readonly generator?: string;
}

/** sha256 of UTF-8 text, hex. */
export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Reads the ledger, or an empty one when absent or unreadable. */
export function readGeneratedLedger(outDir: string): GeneratedLedger {
  const file = path.join(outDir, GENERATED_LEDGER_NAME);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<GeneratedLedger>;
    if (parsed.schemaVersion === 1 && parsed.files && typeof parsed.files === "object") {
      return { schemaVersion: 1, generator: String(parsed.generator ?? ""), files: parsed.files };
    }
  } catch {
    // Missing or corrupt ledger: every existing file counts as foreign.
  }
  return { schemaVersion: 1, generator: "", files: {} };
}

/**
 * Writes `content` to `target` through a temporary file in the same
 * directory and a rename, so readers (Lens Studio, the preview, a second
 * watcher) see the old file or the new one, never a partial one. The path
 * does not change, so a sibling `.meta` file is untouched.
 */
export function writeFileAtomic(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), "." + path.basename(target) + ".tmp-" + process.pid + "-" + Date.now());
  try {
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * Writes generated files into `outDir` without destroying anything the SDK
 * does not own:
 *
 * - a file is replaced only when it is what the SDK last wrote (its sha256
 *   matches the ledger) or is named in `forceOverwrite`;
 * - an edited or foreign file is kept and reported;
 * - identical content is not rewritten;
 * - nothing is ever deleted: no stale-file cleanup, no `.meta` changes.
 *
 * The ledger is written last, atomically, with the files this call owns.
 */
export function writeGeneratedFiles(
  outDir: string,
  files: readonly GeneratedFile[],
  options: WriteGeneratedFilesOptions = {}
): GeneratedFileOutcome[] {
  const ledger = readGeneratedLedger(outDir);
  const owned: Record<string, { sha256: string }> = { ...ledger.files };
  const force = new Set(options.forceOverwrite ?? []);
  const outcomes: GeneratedFileOutcome[] = [];
  for (const file of files) {
    if (file.name === GENERATED_LEDGER_NAME || file.name.includes("..") || path.isAbsolute(file.name)) {
      throw new Error("Generated file name must be a plain relative path: " + file.name);
    }
    const target = path.join(outDir, file.name);
    const next = sha256Text(file.content);
    let current: string | undefined;
    try {
      current = sha256Text(fs.readFileSync(target, "utf8"));
    } catch {
      current = undefined;
    }
    const recorded = ledger.files[file.name]?.sha256;
    if (current === undefined) {
      writeFileAtomic(target, file.content);
      owned[file.name] = { sha256: next };
      outcomes.push({ name: file.name, status: "created" });
    } else if (current === next) {
      owned[file.name] = { sha256: next };
      outcomes.push({ name: file.name, status: "unchanged" });
    } else if (recorded === current) {
      writeFileAtomic(target, file.content);
      owned[file.name] = { sha256: next };
      outcomes.push({ name: file.name, status: "updated" });
    } else if (force.has(file.name)) {
      writeFileAtomic(target, file.content);
      owned[file.name] = { sha256: next };
      outcomes.push({ name: file.name, status: "overwritten" });
    } else {
      outcomes.push({ name: file.name, status: recorded === undefined ? "kept-foreign" : "kept-user-edit" });
    }
  }
  const nextLedger: GeneratedLedger = { schemaVersion: 1, generator: options.generator ?? ledger.generator, files: owned };
  writeFileAtomic(path.join(outDir, GENERATED_LEDGER_NAME), JSON.stringify(nextLedger, null, 2) + "\n");
  return outcomes;
}
