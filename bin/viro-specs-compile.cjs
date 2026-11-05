#!/usr/bin/env node
// viro-specs-compile. The implementation is TypeScript in src/specs-cli/,
// compiled with the shared Specs core to bin/specs-build/ by
// `npm run build:specs-cli` (the package `build` and `prepare` scripts run it).
function load() {
  try {
    return {
      main: require("./specs-build/src/specs-cli/main.js"),
      compile: require("./specs-build/src/specs-cli/compile.js"),
      lens: require("./specs-build/src/specs-cli/lensTs.js"),
      diagnostics: require("./specs-build/components/Specs/core/diagnostics.js"),
    };
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND" && String(error.message).includes("specs-build")) {
      console.error(
        "viro-specs-compile: bin/specs-build is missing. Run `npm run build:specs-cli` in the react-viro package."
      );
      process.exit(1);
    }
    throw error;
  }
}

const loaded = load();

if (require.main === module) {
  process.exit(loaded.main.runSpecsCli(process.argv.slice(2)));
}

module.exports = {
  compile: loaded.compile.compileSpecsEntry,
  compileManifestFile: loaded.compile.compileSpecsManifestFile,
  lensTs: loaded.lens.renderSpecsLensHost,
  exitStatus: loaded.diagnostics.viroSpecsExitStatus,
  main: loaded.main.runSpecsCli,
};
