import type { Meta, StoryObj } from "@storybook/html-vite";
import { DEFAULT_ARGS, SCENE_ARG_TYPES, sceneStory, type SceneArgs } from "./mount";
import { scrollViewScene } from "./scenes";

/** SpatialScrollView: a group with a scroll window; the host scrolls in steps of itemHeightMeters. */
const meta = {
  title: "Premium components/SpatialScrollView",
  args: DEFAULT_ARGS,
  argTypes: SCENE_ARG_TYPES,
} satisfies Meta<SceneArgs>;
export default meta;
type Story = StoryObj<SceneArgs>;

export const Top: Story = sceneStory("A scroll group showing two of four rows, at initialIndex 0.", {
  scene: scrollViewScene(),
  id: "scroll-view-top",
});

export const Scrolled: Story = sceneStory("The same list after scrollByRows(+2) through the controller.", {
  scene: scrollViewScene(),
  id: "scroll-view-scrolled",
  scroll: { id: "sv-list", rows: 2 },
});
