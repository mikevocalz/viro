// Jest transform for binary assets in the Specs suites. A bundled asset
// becomes `{ uri: "<path relative to the repo root>" }`, which is the asset ID
// viro-specs-compile derives for the same require() (relative to the nearest
// package.json). The runtime compiler's default sourceResolver reads `uri`, so
// both compilers see the same asset ID without a custom resolver.
const path = require("node:path");

module.exports = {
  process(_source, filename, options) {
    const id = path.relative(options.config.rootDir, filename).split(path.sep).join("/");
    return { code: "module.exports = { uri: " + JSON.stringify(id) + " };" };
  },
  getCacheKey(_source, filename, options) {
    return "viro-specs-asset:" + path.relative(options.config.rootDir, filename);
  },
};
