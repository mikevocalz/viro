import type { Meta, StoryObj } from "@storybook/html-vite";
import { DEFAULT_ARGS, mountScene, SCENE_ARG_TYPES, type SceneArgs } from "./mount";
import { contrastScene, rejectedScene, spatialPanelScene } from "./scenes";

/**
 * Scene-level states the Lens experience controller produces: rejected
 * scenes, degraded capabilities and the high-contrast preference.
 */
const meta = {
  title: "Experience states",
  args: DEFAULT_ARGS,
  argTypes: SCENE_ARG_TYPES,
  parameters: { layout: "fullscreen" },
} satisfies Meta<SceneArgs>;
export default meta;
type Story = StoryObj<SceneArgs>;

export const Rejected: Story = {
  name: "Error / Scene rejected",
  parameters: { docs: { description: { story: "A node names a parent that does not exist. With no earlier scene to fall back to, the error panel replaces the scene." } } },
  render: (args) => mountScene({ scene: rejectedScene(), id: "state-rejected", args, fov: 30 }),
};

export const HandTrackingUnavailable: Story = {
  name: "Degraded / Hand tracking unavailable",
  args: { capabilities: "hand tracking unavailable" },
  parameters: { docs: { description: { story: "The runtime reports hand tracking temporarily unavailable: the notice panel opens and input falls back to gaze." } } },
  render: (args) => mountScene({ scene: spatialPanelScene(), id: "state-degraded-hands", args, fov: 30 }),
};

export const WorldQueryUnsupported: Story = {
  name: "Degraded / World query unsupported",
  args: { capabilities: "world query unsupported" },
  parameters: { docs: { description: { story: "A scene that needs placement on a device without world query: the notice says content opens in front of the wearer. The placement reticle itself is not drawn by the preview." } } },
  render: (args) => mountScene({ scene: spatialPanelScene(), id: "state-degraded-world", args, fov: 30, requirePlacement: true }),
};

export const HighContrast: Story = {
  name: "High contrast",
  args: { highContrast: true },
  parameters: { docs: { description: { story: "preferences.highContrast swaps the surface to #42525f at full opacity, text and muted text to white, and doubles border width." } } },
  render: (args) => mountScene({ scene: contrastScene(), id: "state-high-contrast", args, fov: 30 }),
};

export const HighContrastOff: Story = {
  name: "High contrast / Off (comparison)",
  render: (args) => mountScene({ scene: contrastScene(), id: "state-contrast-off", args, fov: 30 }),
};
