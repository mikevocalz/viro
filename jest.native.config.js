/**
 * The `native` Jest project: everything that does not need
 * `@reactvision/viro-web-renderer`, so it stays green in a plain checkout.
 *
 * The ignore list is the `web` project's `testMatch`, so a suite belongs to
 * exactly one project and adding one there removes it here automatically.
 */
const webConfig = require("./jest.web.config.js");

/** @type {import('jest').Config} */
const config = {
  displayName: "native",
  rootDir: __dirname,
  // `testMatch` entries are globs, `testPathIgnorePatterns` entries are
  // regexes; both forms match these literal suite paths.
  testPathIgnorePatterns: ["/node_modules/", ...webConfig.testMatch],
};

module.exports = config;
