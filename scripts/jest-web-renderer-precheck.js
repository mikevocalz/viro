/**
 * globalSetup for the `web` Jest project.
 *
 * `@reactvision/viro-web-renderer` is an optional peer that is not published to
 * npm and has no public repository, so a plain checkout cannot resolve it. When
 * it is absent every renderer-backed suite dies with its own module-resolution
 * stack trace, which buries the one fact that matters. Fail the project once,
 * before any suite starts, with a single line naming the path we looked for.
 *
 * Point WEB_RENDERER_DIR at a local checkout to run these suites for real; the
 * default is the sibling directory the repo's own moduleNameMapper assumes.
 */
const fs = require("fs");
const path = require("path");

const rendererDir = process.env.WEB_RENDERER_DIR
  ? path.resolve(process.env.WEB_RENDERER_DIR)
  : path.resolve(__dirname, "..", "..", "viro-web-renderer");

const rendererEntry = path.join(rendererDir, "dist", "sceneApi.js");

module.exports = async function assertWebRendererPresent() {
  if (fs.existsSync(rendererEntry)) {
    return;
  }

  const error = new Error(
    `BLOCKED: web suites need @reactvision/viro-web-renderer at ${rendererEntry} (unpublished, no public repo) - set WEB_RENDERER_DIR to a local checkout, see ReactVision/viro#527.`
  );
  // Jest prints the stack for a globalSetup failure; collapse it to the message
  // so the blocker reads as one line instead of a trace through jest-runner.
  error.stack = error.message;
  throw error;
};

module.exports.rendererDir = rendererDir;
module.exports.rendererEntry = rendererEntry;
