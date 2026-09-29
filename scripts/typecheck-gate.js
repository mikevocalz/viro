#!/usr/bin/env node
/**
 * Runs `tsc` for its emit and gates packaging on the diagnostics it produces.
 *
 * Two modules this package types against cannot be installed here:
 *
 *   - `@reactvision/viro-web-renderer` is unpublished and has no public repo.
 *     `node_modules/@reactvision/viro-web-renderer` is a dangling symlink.
 *   - `nitro-canvas-in-Vision` is imported by the panel components but is
 *     declared in no dependency section of package.json.
 *
 * `tsc` still writes complete JS and .d.ts output for every file (the project
 * does not set `noEmitOnError`); only its exit code blocks `npm pack`, because
 * `prepare` short-circuits before `copy-files`. This script keeps the emit,
 * lets through exactly the diagnostics those two absent modules cause, and
 * exits non-zero on anything else.
 *
 * Two diagnostic shapes are allowed, and nothing else:
 *
 *   1. Any diagnostic whose message names one of the two modules (the
 *      TS2307 "Cannot find module" at each import site).
 *   2. TS7006 "implicitly has an 'any' type" in a file that reaches one of
 *      those modules through the repo's own relative imports. A value typed
 *      by an unresolvable module is an error type, so every callback tsc
 *      checks against it loses its parameter types. The reachable set is
 *      computed from the source, not hardcoded.
 *
 * A TS7006 in an untainted file, or any other code anywhere, fails the build.
 */

"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

/** Modules that cannot be resolved in this checkout. */
const ABSENT_MODULES = ["@reactvision/viro-web-renderer", "nitro-canvas-in-Vision"];

/** The only error code tolerated as a knock-on effect of an absent module. */
const IMPLICIT_ANY = "TS7006";

/** Directories never walked when building the import graph. */
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "web-harness", "examples"]);

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/** `path(line,col): error TSxxxx: message` */
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function collectSourceFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(full, out);
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Every module specifier in `source`, from static imports, `export ... from`,
 * and `import(...)`.
 */
function moduleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;]*?from\s*["']([^"']+)["']/g,
    /(?:^|\n)\s*import\s*["']([^"']+)["']/g,
    /(?:^|\n)\s*export\s[^;]*?from\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolve a relative specifier the way tsc's node resolution would. */
function resolveRelative(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.d.ts`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Files that reach an absent module: those that import one directly, plus —
 * transitively — every file that imports such a file. Taint travels from an
 * imported file up to its importers, because that is the direction an error
 * type propagates into the importer's inferred callback parameters.
 */
function filesReachingAbsentModules() {
  const files = collectSourceFiles(REPO_ROOT, []);
  const importers = new Map(); // imported file -> Set<importing file>
  const tainted = new Set();
  const queue = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of moduleSpecifiers(source)) {
      if (ABSENT_MODULES.includes(specifier)) {
        if (!tainted.has(file)) {
          tainted.add(file);
          queue.push(file);
        }
        continue;
      }
      if (!specifier.startsWith(".")) continue;
      const target = resolveRelative(file, specifier);
      if (!target) continue;
      if (!importers.has(target)) importers.set(target, new Set());
      importers.get(target).add(file);
    }
  }

  while (queue.length > 0) {
    const current = queue.pop();
    for (const importer of importers.get(current) || []) {
      if (tainted.has(importer)) continue;
      tainted.add(importer);
      queue.push(importer);
    }
  }
  return tainted;
}

function namesAbsentModule(message) {
  return ABSENT_MODULES.some((name) => message.includes(name));
}

function main() {
  const tsc = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc"],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );

  const output = `${tsc.stdout || ""}${tsc.stderr || ""}`;
  if (output.trim().length > 0) process.stdout.write(output);

  if (tsc.error) {
    console.error(`typecheck-gate: could not run tsc: ${tsc.error.message}`);
    process.exit(1);
  }

  if (tsc.status === 0) {
    console.log("typecheck-gate: tsc reported no errors.");
    return;
  }

  const lines = output.split("\n");
  const diagnostics = [];
  const unparsed = [];
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const match = DIAGNOSTIC.exec(line.trim());
    if (match) {
      diagnostics.push({ file: match[1], code: match[4], message: match[5], line: line.trim() });
    } else {
      unparsed.push(line.trim());
    }
  }

  // Output tsc produced that is not a diagnostic we can classify (a crash, a
  // config error) is never waved through.
  if (unparsed.length > 0) {
    console.error("typecheck-gate: tsc produced output that is not a file diagnostic:");
    for (const line of unparsed) console.error(`  ${line}`);
    process.exit(1);
  }

  if (diagnostics.length === 0) {
    console.error(`typecheck-gate: tsc exited ${tsc.status} with no parseable diagnostics.`);
    process.exit(1);
  }

  const tainted = filesReachingAbsentModules();
  const allowed = [];
  const blocking = [];

  for (const diagnostic of diagnostics) {
    if (namesAbsentModule(diagnostic.message)) {
      allowed.push(diagnostic);
      continue;
    }
    if (diagnostic.code === IMPLICIT_ANY && tainted.has(path.resolve(REPO_ROOT, diagnostic.file))) {
      allowed.push(diagnostic);
      continue;
    }
    blocking.push(diagnostic);
  }

  if (blocking.length > 0) {
    console.error(
      `\ntypecheck-gate: ${blocking.length} error(s) unrelated to the absent modules ` +
        `(${ABSENT_MODULES.join(", ")}):`
    );
    for (const diagnostic of blocking) console.error(`  ${diagnostic.line}`);
    process.exit(1);
  }

  console.log(
    `\ntypecheck-gate: ${allowed.length} error(s), all caused by the absent modules ` +
      `${ABSENT_MODULES.join(" and ")}. Emit is complete; continuing the build.`
  );
}

main();
