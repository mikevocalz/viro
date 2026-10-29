import { defineConfig } from "vite";

/**
 * Vite config for Storybook only. The preview's vite.config.ts builds two
 * HTML pages and serves the viro checkout through a dev middleware; Storybook
 * needs neither. Stories import viro's Specs core from ../../components, so
 * the dev server may read two levels up.
 */
export default defineConfig({
  server: { fs: { allow: ["../.."] } },
});
