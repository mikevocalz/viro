/**
 * The `web` Jest project: the suites whose module graph reaches
 * `@reactvision/viro-web-renderer`. Membership is measured, not guessed - each
 * entry below fails to resolve the renderer package today. The four other
 * `web*` suites (webAudioListener, webCapabilities, webFlexLayout,
 * webStudioRendererEffects) never import it and stay in the `native` project.
 *
 * With the renderer absent this project is BLOCKED: globalSetup throws once.
 * With WEB_RENDERER_DIR set it runs for real against that checkout.
 */
const precheck = require("./scripts/jest-web-renderer-precheck.js");

/** Suites that cannot run without the renderer package. */
const RENDERER_BACKED_SUITES = [
  "<rootDir>/__test__/webImageSurface.test.ts",
  "<rootDir>/__test__/webParticleAppearance.test.ts",
  "<rootDir>/__test__/webParticleVelocity.test.ts",
  "<rootDir>/__test__/webPhysicsShape.test.ts",
  "<rootDir>/__test__/webShaderOverride.test.ts",
];

/** @type {import('jest').Config} */
const config = {
  displayName: "web",
  rootDir: __dirname,
  testMatch: RENDERER_BACKED_SUITES,
  globalSetup: "<rootDir>/scripts/jest-web-renderer-precheck.js",
  moduleNameMapper: {
    "^@reactvision/viro-web-renderer$": precheck.rendererEntry,
  },
};

// `native` reads `testMatch` back off this export so the two projects cannot
// drift into overlapping or orphaned suites.
module.exports = config;
