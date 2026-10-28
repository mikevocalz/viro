import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Two pages: index.html is the manifest preview, gallery.html shows one
 * scene per primitive (the repo has no Storybook). Both import the Specs
 * core from ../../components/Specs/core, so the dev server may read two
 * levels up.
 */
export default defineConfig({
  root: here,
  appType: "mpa",
  server: { fs: { allow: ["../.."] } },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        preview: `${here}index.html`,
        gallery: `${here}gallery.html`,
      },
    },
  },
});
