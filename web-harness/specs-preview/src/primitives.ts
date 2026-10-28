import type { ViroSpecsManifestV2 } from "../../../components/Specs/core/manifest";

/** One gallery entry: a manifest v2 scene that isolates one primitive. */
export interface PrimitiveStory {
  readonly id: string;
  readonly title: string;
  /** What the Lens host does with it, in one sentence. */
  readonly lens: string;
  readonly manifest: ViroSpecsManifestV2;
}

const SHIBA = "examples/visionos-sweep/assets/shiba.glb";
const BUTTON = "examples/visionos-sweep/assets/button.png";
const ROOT_Z = -0.9;
const yaw = (deg: number): [number, number, number, number] => {
  const h = (deg * Math.PI) / 360;
  return [0, Math.sin(h), 0, Math.cos(h)];
};
const empty = { polylines: [], lights: [], materials: [], interactions: [], animations: [] } as const;
const scene = (parts: Partial<ViroSpecsManifestV2> & Pick<ViroSpecsManifestV2, "nodes">): ViroSpecsManifestV2 => ({
  version: 2,
  generator: { name: "hand-written" },
  ...empty,
  ...parts,
});
const label = (id: string, text: string, y: number, parentId = "root") =>
  ({ id, kind: "text", parentId, text, position: [0, y, 0], style: { fontSize: 22, color: "#c9d4e2" } }) as const;

/** Scenes for gallery.html, in reading order. */
export const PRIMITIVE_STORIES: readonly PrimitiveStory[] = [
  {
    id: "transform",
    title: "Transforms",
    lens: "Positions become centimeters, [x, y, z, w] quaternions go to quat(w, x, y, z), children inherit their parent's transform.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "parent", kind: "group", parentId: "root", position: [-0.12, 0, 0], rotation: yaw(35) },
        { id: "child-image", kind: "image", parentId: "parent", source: BUTTON, position: [0.08, 0, 0], extents: { width: 0.12, height: 0.12 } },
        { id: "scaled", kind: "image", parentId: "root", source: BUTTON, position: [0.16, 0, 0], scale: [1.5, 0.75, 1], extents: { width: 0.08, height: 0.08 } },
        label("caption", "35 degree yaw parent; 1.5 x 0.75 scale", -0.14),
      ],
    }),
  },
  {
    id: "text",
    title: "Text and text style",
    lens: "fontSize maps 1:1 to Lens Text size, extents set the layout rect and turn on wrapping, maxLines truncates.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "default", kind: "text", parentId: "root", text: "Default text, size 48", position: [0, 0.12, 0] },
        { id: "styled", kind: "text", parentId: "root", text: "Bold, amber, left aligned", position: [0, 0.04, 0], style: { fontSize: 30, fontWeight: "bold", color: "#f2b544", textAlign: "left" }, extents: { width: 0.36, height: 0.05 } },
        { id: "wrapped", kind: "text", parentId: "root", text: "Extents wrap this sentence inside a 22 cm box and maxLines keeps two lines of it.", position: [0, -0.07, 0], style: { fontSize: 24, color: "#e8eef6", textAlign: "center" }, extents: { width: 0.22, height: 0.2 }, maxLines: 2 },
      ],
    }),
  },
  {
    id: "image",
    title: "Image extents",
    lens: "The image quad scales on a child surface so the node transform keeps its manifest values; extents are meters.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "square", kind: "image", parentId: "root", source: BUTTON, position: [-0.12, 0.02, 0], extents: { width: 0.12, height: 0.12 } },
        { id: "wide", kind: "image", parentId: "root", source: BUTTON, position: [0.1, 0.02, 0], extents: { width: 0.2, height: 0.08 } },
        label("caption", "12 x 12 cm and 20 x 8 cm", -0.12),
      ],
    }),
  },
  {
    id: "model",
    title: "GLB model",
    lens: "GLB prefabs instantiate at scale 100, so one glTF meter is 100 Lens centimeters before the node scale.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, -0.06, ROOT_Z] },
        { id: "shiba", kind: "model", parentId: "root", source: SHIBA, format: "glb", scale: [0.18, 0.18, 0.18], rotation: yaw(-25) },
      ],
    }),
  },
  {
    id: "panel",
    title: "Panel",
    lens: "Lens instantiates the UI Kit Frame prefab and sets its inner size to the extents; children sit in front at z > 0.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "card", kind: "panel", parentId: "root", extents: { width: 0.32, height: 0.2 } },
        { id: "heading", kind: "text", parentId: "card", text: "Settings", position: [0, 0.06, 0.005], style: { fontSize: 30, fontWeight: "bold" } },
        { id: "icon", kind: "image", parentId: "card", source: BUTTON, position: [0, -0.03, 0.005], extents: { width: 0.07, height: 0.07 } },
      ],
    }),
  },
  {
    id: "polyline",
    title: "Polyline",
    lens: "Points are world-space meters; Lens builds a VolumetricLine of radius radiusMeters, so the visible width is twice that.",
    manifest: scene({
      nodes: [{ id: "root", kind: "group", position: [0, 0, ROOT_Z] }],
      polylines: [
        { id: "route", points: [[-0.2, -0.08, ROOT_Z], [-0.05, 0.06, ROOT_Z], [0.08, -0.02, ROOT_Z], [0.2, 0.09, ROOT_Z]], radiusMeters: 0.006, materialId: "route" },
        { id: "thin", points: [[-0.2, -0.13, ROOT_Z], [0.2, -0.13, ROOT_Z]], radiusMeters: 0.0015 },
      ],
      materials: [{ id: "route", color: "#2e9cc0" }],
    }),
  },
  {
    id: "material",
    title: "Materials and opacity",
    lens: "A material's alpha is color alpha times opacity; node opacity then overrides alpha on a per-node clone.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "opaque", kind: "image", parentId: "root", source: BUTTON, position: [-0.14, 0, 0], extents: { width: 0.1, height: 0.1 }, materialId: "tint" },
        { id: "sixty", kind: "image", parentId: "root", source: BUTTON, position: [0, 0, 0], extents: { width: 0.1, height: 0.1 }, materialId: "tint", opacity: 0.6 },
        { id: "thirty", kind: "image", parentId: "root", source: BUTTON, position: [0.14, 0, 0], extents: { width: 0.1, height: 0.1 }, materialId: "tint", opacity: 0.3 },
        label("caption", "opacity 1, 0.6, 0.3", -0.11),
      ],
      materials: [{ id: "tint", color: "#9fd8ea" }],
    }),
  },
  {
    id: "lights",
    title: "Lights",
    lens: "Viro lumens divide by 1000 into Lens intensity; directional and spot lights aim along their direction vector.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, -0.06, ROOT_Z] },
        { id: "shiba", kind: "model", parentId: "root", source: SHIBA, format: "glb", scale: [0.18, 0.18, 0.18] },
      ],
      lights: [
        { id: "ambient", type: "ambient", color: "#ffffff", intensity: 250 },
        { id: "key", type: "directional", direction: [-0.5, -0.4, -1], color: "#ffd9a8", intensity: 1800 },
        { id: "rim", type: "omni", position: [0.3, 0.2, -1.1], color: "#7fc8ff", intensity: 1500 },
      ],
    }),
  },
  {
    id: "placeholder",
    title: "Missing-asset placeholder",
    lens: "A source the registry cannot resolve shows a tinted box (VS5003): image extents by 1 cm, or a 20 cm cube for models.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z], rotation: yaw(-20) },
        { id: "missing-image", kind: "image", parentId: "root", source: "assets/not-there.png", position: [-0.13, 0, 0], extents: { width: 0.14, height: 0.1 } },
        { id: "missing-model", kind: "model", parentId: "root", source: "assets/not-there.glb", position: [0.12, 0, 0] },
      ],
    }),
  },
  {
    id: "animation",
    title: "Animation",
    lens: "Plans run from the current value to an absolute target with Lens cubic-bezier easing; loop repeats, single completes once.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "pulse", kind: "image", parentId: "root", source: BUTTON, position: [-0.1, 0, 0], extents: { width: 0.1, height: 0.1 } },
        { id: "spin", kind: "model", parentId: "root", source: SHIBA, format: "glb", position: [0.1, -0.05, 0], scale: [0.12, 0.12, 0.12] },
      ],
      animations: [
        {
          nodeId: "pulse", name: "pulse",
          plan: { engine: "AnimationPlayer", durationSeconds: 0.5, delaySeconds: 0, easing: "ease-in-out", playbackMode: "loop", completionEvent: "pulse", tracks: [{ target: "transform.scale.x", from: "current", to: 1.3 }, { target: "transform.scale.y", from: "current", to: 1.3 }, { target: "material.opacity", from: "current", to: 0.5 }] },
        },
        {
          nodeId: "spin", name: "turn",
          plan: { engine: "AnimationPlayer", durationSeconds: 0.5, delaySeconds: 0, easing: "linear", playbackMode: "loop", completionEvent: "turn", tracks: [{ target: "transform.rotation.y", from: "current", to: 90 }] },
        },
      ],
    }),
  },
  {
    id: "interaction",
    title: "Interaction",
    lens: "Interactable nodes get SIK hover, select and drag; manipulation lets the wearer move the node. Try it in the preview.",
    manifest: scene({
      nodes: [
        { id: "root", kind: "group", position: [0, 0, ROOT_Z] },
        { id: "button", kind: "image", parentId: "root", source: BUTTON, position: [-0.1, 0, 0], extents: { width: 0.1, height: 0.1 } },
        { id: "shiba", kind: "model", parentId: "root", source: SHIBA, format: "glb", position: [0.1, -0.05, 0], scale: [0.12, 0.12, 0.12] },
        label("caption", "button: hover + select; shiba: select + drag", -0.12),
      ],
      interactions: [
        { nodeId: "button", interactable: true, manipulation: false, events: ["hover", "select"] },
        { nodeId: "shiba", interactable: true, manipulation: true, events: ["select", "drag"] },
      ],
    }),
  },
];
