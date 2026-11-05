import type { Meta, StoryObj } from "@storybook/html-vite";
import { PRIMITIVE_STORIES, type PrimitiveStory } from "../primitives";
import { DEFAULT_ARGS, mountScene, SCENE_ARG_TYPES, type SceneArgs } from "./mount";

/**
 * Scene primitives: one story per manifest node kind and scene field, using
 * the same documents as gallery.html (src/primitives.ts).
 */
const meta = {
  title: "Scene primitives",
  args: DEFAULT_ARGS,
  argTypes: SCENE_ARG_TYPES,
  parameters: { layout: "fullscreen" },
} satisfies Meta<SceneArgs>;
export default meta;
type Story = StoryObj<SceneArgs>;

function entry(id: string): PrimitiveStory {
  const found = PRIMITIVE_STORIES.find((s) => s.id === id);
  if (!found) throw new Error("No primitive story " + id);
  return found;
}

function primitive(id: string): Story {
  const story = entry(id);
  return {
    parameters: { docs: { description: { story: story.lens } } },
    render: (args) => mountScene({ scene: story.manifest, id: "primitive-" + id, args }),
  };
}

export const Transforms = primitive("transform");
export const Text = primitive("text");
export const Image = primitive("image");
export const Model = primitive("model");
export const Panel = primitive("panel");
export const Polyline = primitive("polyline");
export const Materials = primitive("material");
export const Lights = primitive("lights");
export const Animation = primitive("animation");
export const Interaction = primitive("interaction");
export const MissingAssets = primitive("placeholder");
