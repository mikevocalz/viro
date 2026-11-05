#!/usr/bin/env node
// Writes docs/specs-error-reference.md from VIRO_SPECS_DIAGNOSTICS in
// components/Specs/core/diagnosticCodes.ts. The page is never edited by
// hand: __test__/ViroSpecsReleaseDocs.test.ts renders it from the catalog
// and fails when the committed copy differs.
//
// The catalog is read from the TypeScript source with Node's type stripping
// (Node 22.18+), never from bin/specs-build: a build left over from an older
// checkout let --check pass against codes the source no longer had.
//
//   node scripts/specs-error-reference.cjs [--check]
const fs = require("node:fs");
const path = require("node:path");

const RANGES = [
  { prefix: "VS1", title: "VS1xxx: manifest and protocol validation", where: "`parseSpecsManifest`, `parseSpecsManifestJson`, `validateSpecsManifestV2`, `validateSpecsSceneSnapshot`, `migrateSpecsManifest` and `viro-specs-compile --manifest`" },
  { prefix: "VS2", title: "VS2xxx: static source analysis", where: "`viro-specs-compile --entry` (Babel AST of your scene source)" },
  { prefix: "VS3", title: "VS3xxx: compile semantics", where: "both compilers (`ViroSpecsScene` at runtime and `viro-specs-compile`) and the runtime transport" },
  { prefix: "VS4", title: "VS4xxx: capability errors", where: "both compilers, for Viro features the SPECS target does not implement" },
  { prefix: "VS5", title: "VS5xxx: Lens scene host", where: "`ViroSpecsHostDiagnostics` inside the Lens (`@viro-external/specs`), mirrored here so a Lens log code reads the same" },
];

function cell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** @param {Record<string, {severity: string, title: string, hint: string}>} catalog */
function renderErrorReference(catalog) {
  const codes = Object.keys(catalog).sort();
  const counts = { error: 0, warning: 0, info: 0 };
  for (const code of codes) counts[catalog[code].severity]++;
  const lines = [
    "<!-- Generated from components/Specs/core/diagnosticCodes.ts by scripts/specs-error-reference.cjs. Do not edit. -->",
    "",
    "# Specs error reference",
    "",
    `${codes.length} codes: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} info. Severity is fixed per code.`,
    "An `error` stops the build (`viro-specs-compile` exits 1 and writes nothing; `ViroSpecsScene` keeps the previous scene).",
    "A `warning` lets the build through unless you pass `--strict`. Background, examples and the diagnostic object",
    "shape are in [specs-diagnostics.md](specs-diagnostics.md); each code there has its own section.",
    "",
  ];
  for (const range of RANGES) {
    const inRange = codes.filter((code) => code.startsWith(range.prefix));
    if (inRange.length === 0) continue;
    lines.push(`## ${range.title}`, "", `Emitted by ${range.where}.`, "", "| Code | Severity | Problem | Fix |", "| --- | --- | --- | --- |");
    for (const code of inRange) {
      const entry = catalog[code];
      lines.push(`| [${code}](specs-diagnostics.md#${code.toLowerCase()}--${entry.severity}) | ${entry.severity} | ${cell(entry.title)} | ${cell(entry.hint)} |`);
    }
    lines.push("");
  }
  const unknown = codes.filter((code) => !RANGES.some((range) => code.startsWith(range.prefix)));
  if (unknown.length > 0) throw new Error(`codes outside the documented ranges: ${unknown.join(", ")}`);
  return lines.join("\n");
}

module.exports = { renderErrorReference };

/**
 * Loads VIRO_SPECS_DIAGNOSTICS from the TypeScript source under `repo`.
 * @param {string} repo
 */
function loadCatalogFromSource(repo) {
  const source = path.join(repo, "components", "Specs", "core", "diagnosticCodes.ts");
  try {
    return require(source).VIRO_SPECS_DIAGNOSTICS;
  } catch (error) {
    if (error && error.code === "ERR_UNKNOWN_FILE_EXTENSION") {
      throw new Error(`Node ${process.version} cannot load ${source}. Use Node 22.18 or newer (TypeScript type stripping).`);
    }
    throw error;
  }
}

module.exports.loadCatalogFromSource = loadCatalogFromSource;

if (require.main === module) {
  const repo = path.resolve(__dirname, "..");
  const catalog = loadCatalogFromSource(repo);
  const target = path.join(repo, "docs", "specs-error-reference.md");
  const rendered = renderErrorReference(catalog);
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    if (current !== rendered) {
      console.error("docs/specs-error-reference.md is out of date. Run `node scripts/specs-error-reference.cjs`.");
      process.exit(1);
    }
    console.log(`docs/specs-error-reference.md matches the catalog in components/Specs/core/diagnosticCodes.ts (${Object.keys(catalog).length} codes)`);
  } else {
    fs.writeFileSync(target, rendered);
    console.log(`wrote docs/specs-error-reference.md (${Object.keys(catalog).length} codes)`);
  }
}
