import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/html-vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

/**
 * Stories render through the preview's own PreviewStage and PreviewExperience.
 * Assets keep their manifest IDs: the asset store requests
 * /viro-repo/<id>, so the example assets are served at that path, in dev
 * and in storybook-static.
 */
const config: StorybookConfig = {
  framework: {
    name: "@storybook/html-vite",
    options: { builder: { viteConfigPath: path.join(here, "vite.config.ts") } },
  },
  stories: ["../src/stories/**/*.stories.ts"],
  staticDirs: [{ from: path.join(repoRoot, "examples/visionos-sweep/assets"), to: "/viro-repo/examples/visionos-sweep/assets" }],
  core: { disableTelemetry: true },
};

export default config;
