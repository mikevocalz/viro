import type { Meta, StoryObj } from "@storybook/html-vite";
import { DEFAULT_ARGS, SCENE_ARG_TYPES, sceneStory, type SceneArgs } from "./mount";
import { MISSING_MODEL, modelViewerScene, SHIBA } from "./scenes";

/** ModelViewer: a model node with the model-viewer component. Ready, turntable with Reset model, loading (request held open) and error (unresolved source). */
const meta = {
  title: "Premium components/ModelViewer",
  args: DEFAULT_ARGS,
  argTypes: SCENE_ARG_TYPES,
} satisfies Meta<SceneArgs>;
export default meta;
type Story = StoryObj<SceneArgs>;

export const Ready: Story = sceneStory("A `model` node with the model-viewer component and a status panel.", {
  scene: modelViewerScene(),
  id: "model-viewer-ready",
  fov: 36,
});

export const Turntable: Story = sceneStory("`autoRotate` and `resettable`: the model turns at 18 degrees a second (not under reduced motion or while held), and Reset model sits under its bounds. Drag the model, then Reset to ease it back.", {
  scene: modelViewerScene(SHIBA, { autoRotate: true, resettable: true }),
  id: "model-viewer-turntable",
  fov: 36,
});

export const Loading: Story = sceneStory("The GLB request is held open, so the scene stays in `loading` and the Lens loading panel shows. After 2 s the line changes to the slow-loading copy.",
  { scene: modelViewerScene(), id: "model-viewer-loading", fov: 36, holdSources: [SHIBA] }
);

export const LoadError: Story = sceneStory("The model source does not resolve: a 20 cm placeholder cube, VS5003, and the error panel with Retry.",
  { scene: modelViewerScene(MISSING_MODEL), id: "model-viewer-error", fov: 36 }
);
