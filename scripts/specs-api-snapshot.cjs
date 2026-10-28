#!/usr/bin/env node
// Public API snapshot for the Specs surface of @reactvision/react-viro.
//
// Emits declarations for the package into a temporary folder, then writes
// api/specs.api.d.ts with two parts:
//   1. every name the package root (index.ts) exports from components/Specs,
//      with the module it comes from, sorted by name
//   2. the emitted .d.ts of every file under components/Specs, in path order
// and compares it with the committed copy. Any change to a Specs export,
// signature or doc comment fails until the snapshot is regenerated in the
// same commit, so the change shows up in review next to its CHANGELOG entry
// and version bump (docs/specs-release.md).
//
//   node scripts/specs-api-snapshot.cjs           # check, exit 1 on drift
//   node scripts/specs-api-snapshot.cjs --update  # rewrite the snapshot
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repo = path.resolve(__dirname, "..");
const snapshotPath = path.join(repo, "api", "specs.api.d.ts");
const update = process.argv.includes("--update");
const SPECS = "./components/Specs/";

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else list.push(full);
  }
  return list;
}

/** Splits `a, type b, c as d` into exported names with their local names. */
function specifiers(list) {
  return list
    .split(",")
    .map((item) => item.trim().replace(/^type\s+/, ""))
    .filter(Boolean)
    .map((item) => {
      const [local, exported] = item.split(/\s+as\s+/);
      return { local: local.trim(), exported: (exported ?? local).trim() };
    });
}

/** Names the package root exports from components/Specs, read from the emitted index.d.ts. */
function rootExports(indexDts) {
  const source = indexDts.replace(/\s+/g, " ");
  const imported = new Map();
  for (const match of source.matchAll(/import (?:type )?\{([^}]*)\} from "([^"]+)";/g)) {
    for (const { local } of specifiers(match[1])) imported.set(local, match[2]);
  }
  const rows = new Map();
  for (const match of source.matchAll(/export (type )?\{([^}]*)\}( from "([^"]+)")?;/g)) {
    const isType = Boolean(match[1]);
    for (const { local, exported } of specifiers(match[2])) {
      const from = match[4] ?? imported.get(local);
      if (from && from.startsWith(SPECS)) rows.set(exported, `${isType ? "type " : ""}${exported} <- ${from}${local !== exported ? ` (${local})` : ""}`);
    }
  }
  return [...rows.keys()].sort().map((name) => rows.get(name));
}

function render() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-api-"));
  try {
    const tsc = path.join(repo, "node_modules", ".bin", "tsc");
    execFileSync(tsc, ["-p", path.join(repo, "tsconfig.json"), "--declaration", "--emitDeclarationOnly", "--declarationMap", "false", "--outDir", out], {
      cwd: repo,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exports = rootExports(fs.readFileSync(path.join(out, "index.d.ts"), "utf8"));
    const specsDir = path.join(out, "components", "Specs");
    const files = walk(specsDir).filter((file) => file.endsWith(".d.ts")).sort();
    const parts = [
      "// API snapshot for the Specs surface of @reactvision/react-viro.",
      "// Regenerate with: node scripts/specs-api-snapshot.cjs --update",
      "",
      `// ---- package root exports from components/Specs (${exports.length})`,
      ...exports.map((row) => `// ${row}`),
      "",
    ];
    for (const file of files) {
      parts.push(`// ---- components/Specs/${path.relative(specsDir, file).split(path.sep).join("/")}`, fs.readFileSync(file, "utf8").trimEnd(), "");
    }
    return parts.join("\n");
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

const actual = render();
const rel = path.relative(repo, snapshotPath);
if (update) {
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, actual);
  console.log(`wrote ${rel}`);
  process.exit(0);
}
const expected = fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath, "utf8") : "";
if (expected === actual) {
  console.log(`ok    ${rel}`);
  process.exit(0);
}
const a = expected.split("\n");
const b = actual.split("\n");
let line = 0;
while (line < a.length && line < b.length && a[line] === b[line]) line++;
console.error(`DRIFT ${rel} (first difference at line ${line + 1})`);
console.error(`  committed: ${a[line] ?? "<end of file>"}`);
console.error(`  current:   ${b[line] ?? "<end of file>"}`);
console.error("If the change is intended, run `node scripts/specs-api-snapshot.cjs --update` and commit the snapshot");
console.error("with a CHANGELOG entry and the version bump docs/specs-release.md calls for.");
process.exit(1);
