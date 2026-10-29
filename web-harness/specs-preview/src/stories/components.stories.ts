import type { Meta, StoryObj } from "@storybook/html-vite";
import { DEFAULT_ARGS, SCENE_ARG_TYPES, sceneStory, type SceneArgs } from "./mount";
import { panelImageScene, panelTextScene, spatialPanelScene } from "./scenes";

/** SpatialPanel, PanelText and PanelImage as the Lens host draws them: the node carries a `component`, and the experience layer adds the backing, title and tone from theme tokens. */
const meta = {
  title: "Premium components",
  args: DEFAULT_ARGS,
  argTypes: SCENE_ARG_TYPES,
} satisfies Meta<SceneArgs>;
export default meta;
type Story = StoryObj<SceneArgs>;

export const SpatialPanel: Story = sceneStory("A `panel` node with a token surface and a title drawn at type.title.", {
  scene: spatialPanelScene(),
  id: "spatial-panel",
});

export const PanelText: Story = sceneStory("Title, body and label roles in the default and muted tones.", {
  scene: panelTextScene(),
  id: "panel-text",
});

export const PanelImage: Story = sceneStory("A loaded image and an unresolved source, which gets a placeholder and VS5003.", {
  scene: panelImageScene(),
  id: "panel-image",
});
