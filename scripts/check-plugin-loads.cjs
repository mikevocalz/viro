#!/usr/bin/env node
// Loads the published config plugin the way @expo/config-plugins does: plain
// Node require(), no Babel, no bundler. Fails if app.plugin.js or any compiled
// file under dist/plugins cannot be required, or if a file still carries ESM
// syntax (Node 22+ may load extensionless ESM through require(esm) only to
// fail on its relative imports, and older Node throws a SyntaxError).
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const distPlugins = path.join(root, "dist", "plugins");
const failures = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

const entry = path.join(root, "app.plugin.js");
try {
  const plugin = require(entry);
  const fn = typeof plugin === "function" ? plugin : plugin && plugin.default;
  if (typeof fn !== "function") {
    failures.push(`app.plugin.js: expected a config plugin function, got ${typeof fn}`);
  }
} catch (error) {
  failures.push(`app.plugin.js: ${error.code ?? ""} ${error.message}`);
}

if (!fs.existsSync(distPlugins)) {
  failures.push("dist/plugins is missing; run npm run build");
} else {
  for (const file of walk(distPlugins)) {
    const rel = path.relative(root, file);
    const source = fs.readFileSync(file, "utf8");
    // Matches JS module syntax only. The Android plugin embeds Kotlin source in
    // template strings, whose `import com.foo.Bar` lines have no `from` clause.
    const esm =
      /^\s*import\s[^\n]*\sfrom\s+["']/m.test(source) ||
      /^\s*export\s+(\{|\*|default\b|const\b|let\b|var\b|function\b|async\b|class\b)/m.test(source);
    if (esm) {
      failures.push(`${rel}: contains ESM import/export syntax`);
      continue;
    }
    try {
      require(file);
    } catch (error) {
      failures.push(`${rel}: ${error.code ?? ""} ${error.message}`);
    }
  }
}

const visionShim = path.join(root, "plugins", "withViroVisionOS.js");
try {
  require(visionShim);
} catch (error) {
  failures.push(`plugins/withViroVisionOS.js: ${error.code ?? ""} ${error.message}`);
}

if (failures.length > 0) {
  console.error("Config plugin load check failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("Config plugin load check passed.");
