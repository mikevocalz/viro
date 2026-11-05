import type { Meta, StoryObj } from "@storybook/html-vite";
import { DEFAULT_ARGS, SCENE_ARG_TYPES, sceneStory, type SceneArgs } from "./mount";
import { panelButtonScene, panelButtonStatesScene } from "./scenes";

/** PanelButton: five authored states (idle, selected, disabled, loading, error) and two the host derives from input (hover, pressed). */
const meta = {
  title: "Premium components/PanelButton",
  args: DEFAULT_ARGS,
  argTypes: SCENE_ARG_TYPES,
} satisfies Meta<SceneArgs>;
export default meta;
type Story = StoryObj<SceneArgs>;

export const Default: Story = sceneStory("Authored state `idle`, no input.", {
  scene: panelButtonScene("idle"),
  id: "panel-button-default",
});

export const Hover: Story = sceneStory("Idle button after a hover-enter from the host: raised fill, hover scale and depth.", {
  scene: panelButtonScene("idle"),
  id: "panel-button-hover",
  input: [{ nodeId: "pb-button", phases: ["hover-enter"] }],
});

export const Pressed: Story = sceneStory("Idle button after hover-enter and select-start: pressed fill, back at base depth.", {
  scene: panelButtonScene("idle"),
  id: "panel-button-pressed",
  input: [{ nodeId: "pb-button", phases: ["hover-enter", "select-start"] }],
});

export const Disabled: Story = sceneStory("Authored state `disabled`. The story also sends hover-enter; the tracker ignores it.", {
  scene: panelButtonScene("disabled"),
  id: "panel-button-disabled",
  input: [{ nodeId: "pb-button", phases: ["hover-enter"] }],
});

export const Selected: Story = sceneStory("Authored state `selected`: check glyph and selected fill.", {
  scene: panelButtonScene("selected"),
  id: "panel-button-selected",
});

export const Loading: Story = sceneStory("Authored state `loading`: the label reads Working and input is ignored.", {
  scene: panelButtonScene("loading"),
  id: "panel-button-loading",
});

export const ErrorState: Story = sceneStory("Authored state `error` with an errorMessage drawn under the button.", {
  scene: panelButtonScene("error"),
  id: "panel-button-error",
});

export const AllStates: Story = sceneStory("Seven visual states side by side. Hover and Pressed are idle buttons with replayed input.", {
  scene: panelButtonStatesScene(),
  id: "panel-button-states",
  fov: 34,
  input: [
    { nodeId: "pbs-hover", phases: ["hover-enter"] },
    { nodeId: "pbs-pressed", phases: ["hover-enter", "select-start"] },
  ],
});
