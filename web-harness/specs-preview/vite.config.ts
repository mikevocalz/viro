import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

/** Read-only directories of the viro checkout the preview may load scenes and assets from. */
const SERVED = ["examples", "__test__/fixtures/specs", "web-harness/specs-preview/fixtures"];
const TYPES: Record<string, string> = {
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".hdr": "application/octet-stream",
  ".bin": "application/octet-stream",
};

/**
 * Serves manifest asset IDs (paths relative to the viro checkout, the
 * compiler's convention) at /viro-repo/<path>. Only GET, only the listed
 * directories, no traversal. Anything else is a 404, which the preview
 * reports as a missing asset.
 */
function viroRepo(): Plugin {
  return {
    name: "viro-repo-assets",
    configureServer(server) {
      server.middlewares.use("/viro-repo", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/").replace(/^\/+/, "");
        const file = path.resolve(repoRoot, rel);
        const allowed = SERVED.some((dir) => file.startsWith(path.join(repoRoot, dir) + path.sep));
        if (!allowed || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end("Not served: " + rel);
          return;
        }
        res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * Two pages: index.html is the manifest preview, gallery.html shows one
 * scene per primitive (the viro repo has no Storybook). Both import viro's
 * Specs core from ../../components/Specs/core.
 */
export default defineConfig({
  root: here,
  appType: "mpa",
  plugins: [viroRepo()],
  server: { fs: { allow: ["../.."] } },
  preview: { port: 4317 },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        preview: path.join(here, "index.html"),
        gallery: path.join(here, "gallery.html"),
      },
    },
  },
});
