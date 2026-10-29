import type { Preview } from "@storybook/html-vite";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    options: { storySort: { order: ["Scene primitives", "Premium components", "Experience states"] } },
  },
};

export default preview;
