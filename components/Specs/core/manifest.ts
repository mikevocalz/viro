/**
 * Types for the portable Specs scene manifest. The JSON Schema in
 * `schemas/viro-specs-manifest.v2.json` describes the same shape; the
 * conformance tests keep the two in step.
 *
 * Units: positions and extents in meters, rotations as unit quaternions
 * `[x, y, z, w]`, durations in seconds, colors as `#RRGGBB` or `#RRGGBBAA`.
 */

import type { ViroSpecsTheme } from "./tokens";

/** `[x, y, z]`. */
export type ViroSpecsVec3 = readonly [number, number, number];

/** Unit quaternion `[x, y, z, w]`. */
export type ViroSpecsQuat = readonly [number, number, number, number];

/** Width and height in meters, both greater than 0. */
export interface ViroSpecsExtents {
  readonly width: number;
  readonly height: number;
}

/** Text style carried from ViroText `style`. `fontSize` uses Viro points. */
export interface ViroSpecsTextStyle {
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly fontWeight?:
    | "normal"
    | "bold"
    | "100"
    | "200"
    | "300"
    | "400"
    | "500"
    | "600"
    | "700"
    | "800"
    | "900";
  readonly fontStyle?: "normal" | "italic";
  readonly color?: string;
  readonly textAlign?: "left" | "center" | "right";
  readonly textAlignVertical?: "top" | "center" | "bottom";
}

/** Fields every node kind shares. */
export interface ViroSpecsNodeBase {
  /** Unique across nodes, polylines and lights. */
  readonly id: string;
  /** ID of the parent node. Absent means the scene root. */
  readonly parentId?: string;
  /** Local position in meters. */
  readonly position?: ViroSpecsVec3;
  /** Local rotation. */
  readonly rotation?: ViroSpecsQuat;
  /** Local scale. */
  readonly scale?: ViroSpecsVec3;
  readonly visible?: boolean;
  /** 0 to 1. */
  readonly opacity?: number;
  /** ID of an entry in {@linkcode ViroSpecsManifestV2.materials} or the Lens material registry. */
  readonly materialId?: string;
  /**
   * Accessible name: what the node is or does, not the control type
   * ("Reset model", not "Button"). Required on every node an interaction
   * targets; `VS3016` reports a missing one. The host appends ", selected" or
   * ", unavailable" itself, so authors never write state into the label.
   */
  readonly label?: string;
  /**
   * Premium component the node was compiled from. The Lens host draws the
   * component's visuals from {@linkcode ViroSpecsManifestV2.theme} tokens.
   */
  readonly component?: ViroSpecsComponentSpec;
}

/**
 * States of a PanelButton the app sets. `hover` and `pressed` are added by
 * the host from interaction phases, giving the seven visual states in
 * `docs/ux/spatial-tokens.md#panelbutton`.
 */
export type ViroSpecsButtonAuthoredState = "idle" | "selected" | "disabled" | "loading" | "error";

/** Every PanelButton visual state, authored or host-driven. */
export type ViroSpecsButtonVisualState = ViroSpecsButtonAuthoredState | "hover" | "pressed";

/** Type roles of PanelText, mapped to `type.titleDeg`, `type.bodyDeg` and `type.labelDeg`. */
export type ViroSpecsTextRole = "title" | "body" | "label";

/** SpatialPanel: a `panel` node with a surface, border and padding from tokens. */
export interface ViroSpecsSpatialPanelSpec {
  readonly type: "spatial-panel";
  /** Title drawn at `type.title`. */
  readonly title?: string;
}

/** PanelText: a `text` node sized by role, never below `type.minAngleDeg`. */
export interface ViroSpecsPanelTextSpec {
  readonly type: "panel-text";
  readonly role: ViroSpecsTextRole;
  readonly tone: "default" | "muted";
}

/** PanelButton: a `panel` node whose `label` is also the visible text. */
export interface ViroSpecsPanelButtonSpec {
  readonly type: "panel-button";
  readonly state: ViroSpecsButtonAuthoredState;
  /** Short reason shown under the button in the `error` state. */
  readonly errorMessage?: string;
}

/** PanelImage: an `image` node with `radius.card` corners; missing images get a placeholder. */
export interface ViroSpecsPanelImageSpec {
  readonly type: "panel-image";
}

/**
 * SpatialScrollView: a `panel` node whose extents are the viewport. Children
 * scroll inside it and are clipped at its edges; the host keeps the scroll
 * position for the node ID across updates and navigation.
 */
export interface ViroSpecsScrollViewSpec {
  readonly type: "scroll-view";
  /** Height of one row in meters; one scroll step. */
  readonly itemHeightMeters: number;
  /** Row shown first when nothing has been retained yet. */
  readonly initialIndex: number;
}

/**
 * Model viewer: a `model` node with load (progress ring), error
 * (placeholder + `error.asset` copy), manipulate, animate and reset.
 */
export interface ViroSpecsModelViewerSpec {
  readonly type: "model-viewer";
  /** Slow turntable rotation. Always off under reduced motion. */
  readonly autoRotate: boolean;
  /** Shows a "Reset model" button that returns the authored transform. */
  readonly resettable: boolean;
}

/** Premium component carried on a node. Discriminated by `type`. */
export type ViroSpecsComponentSpec =
  | ViroSpecsSpatialPanelSpec
  | ViroSpecsPanelTextSpec
  | ViroSpecsPanelButtonSpec
  | ViroSpecsPanelImageSpec
  | ViroSpecsScrollViewSpec
  | ViroSpecsModelViewerSpec;

/** Premium component type names. */
export type ViroSpecsComponentType = ViroSpecsComponentSpec["type"];

/** Node kind each premium component must sit on. */
export const VIRO_SPECS_COMPONENT_NODE_KIND = {
  "spatial-panel": "panel",
  "panel-text": "text",
  "panel-button": "panel",
  "panel-image": "image",
  "scroll-view": "panel",
  "model-viewer": "model",
} as const satisfies Record<ViroSpecsComponentType, string>;

/** Transform-only container. Maps from ViroNode. */
export interface ViroSpecsGroupNode extends ViroSpecsNodeBase {
  readonly kind: "group";
}

/** Maps from ViroText. */
export interface ViroSpecsTextNode extends ViroSpecsNodeBase {
  readonly kind: "text";
  readonly text: string;
  readonly style?: ViroSpecsTextStyle;
  /** Text box size from ViroText `width` and `height`. */
  readonly extents?: ViroSpecsExtents;
  /** Positive integer. */
  readonly maxLines?: number;
}

/** Maps from ViroImage. */
export interface ViroSpecsImageNode extends ViroSpecsNodeBase {
  readonly kind: "image";
  /** Asset ID bound by the Lens asset registry. */
  readonly source: string;
  readonly extents?: ViroSpecsExtents;
}

/** Model formats a manifest can name. Lens Studio cannot import `vrx`. */
export type ViroSpecsModelFormat = "glb" | "gltf" | "obj" | "fbx";

/** Maps from Viro3DObject. */
export interface ViroSpecsModelNode extends ViroSpecsNodeBase {
  readonly kind: "model";
  readonly source: string;
  readonly format?: ViroSpecsModelFormat;
}

/** Flat UI surface with layout extents. No compiler emits it yet; hand-written manifests may. */
export interface ViroSpecsPanelNode extends ViroSpecsNodeBase {
  readonly kind: "panel";
  readonly extents: ViroSpecsExtents;
}

/**
 * Video surface. The schema accepts it so the contract is complete, and
 * validation reports capability error `VS4004` because no Specs host plays
 * video.
 */
export interface ViroSpecsVideoNode extends ViroSpecsNodeBase {
  readonly kind: "video";
  readonly source: string;
  readonly extents?: ViroSpecsExtents;
  readonly loop?: boolean;
  readonly muted?: boolean;
}

/**
 * Sound emitter. Validation reports capability error `VS4005` because no
 * Specs host plays audio.
 */
export interface ViroSpecsSoundNode extends ViroSpecsNodeBase {
  readonly kind: "sound";
  readonly source: string;
  readonly loop?: boolean;
  /** 0 to 1. */
  readonly volume?: number;
}

/** Any manifest node. Discriminated by `kind`. */
export type ViroSpecsManifestNode =
  | ViroSpecsGroupNode
  | ViroSpecsTextNode
  | ViroSpecsImageNode
  | ViroSpecsModelNode
  | ViroSpecsPanelNode
  | ViroSpecsVideoNode
  | ViroSpecsSoundNode;

/** Node kinds in manifest v2. */
export type ViroSpecsNodeKind = ViroSpecsManifestNode["kind"];

/** World-space line from ViroPolyline. Points are already transformed. */
export interface ViroSpecsManifestPolyline {
  readonly id: string;
  /** At least two points, world space, meters. */
  readonly points: readonly ViroSpecsVec3[];
  readonly radiusMeters: number;
  readonly materialId?: string;
  /** Lens primitive the host builds. */
  readonly primitive?: "volumetric-line";
  /** Lens package that provides the primitive. */
  readonly backendPackage?: string;
}

/** Material registry entry, from ViroMaterials or written by hand. */
export interface ViroSpecsMaterial {
  readonly id: string;
  readonly color?: string;
  /** 0 to 1. */
  readonly opacity?: number;
  /** Asset ID of a texture. */
  readonly texture?: string;
  readonly lightingModel?: "constant" | "lambert" | "blinn" | "phong" | "pbr";
}

interface ViroSpecsLightBase {
  readonly id: string;
  readonly parentId?: string;
  readonly color?: string;
  /** Viro lumens; 1000 is Viro's default. */
  readonly intensity?: number;
}

/** From ViroAmbientLight. */
export interface ViroSpecsAmbientLight extends ViroSpecsLightBase {
  readonly type: "ambient";
}

/** From ViroDirectionalLight. */
export interface ViroSpecsDirectionalLight extends ViroSpecsLightBase {
  readonly type: "directional";
  readonly direction: ViroSpecsVec3;
}

/** From ViroOmniLight. */
export interface ViroSpecsOmniLight extends ViroSpecsLightBase {
  readonly type: "omni";
  readonly position: ViroSpecsVec3;
}

/** From ViroSpotLight. Angles in degrees. */
export interface ViroSpecsSpotLight extends ViroSpecsLightBase {
  readonly type: "spot";
  readonly position: ViroSpecsVec3;
  readonly direction: ViroSpecsVec3;
  readonly innerAngle?: number;
  readonly outerAngle?: number;
}

/** Any light. Discriminated by `type`. */
export type ViroSpecsLight =
  | ViroSpecsAmbientLight
  | ViroSpecsDirectionalLight
  | ViroSpecsOmniLight
  | ViroSpecsSpotLight;

/** Interaction intent for one node, derived from its Viro callbacks. */
export interface ViroSpecsManifestInteraction {
  readonly nodeId: string;
  readonly interactable: true;
  /** True when the node has onDrag. */
  readonly manipulation: boolean;
  readonly events: readonly ("hover" | "select" | "drag")[];
}

/** Property a {@linkcode ViroSpecsAnimationTrack} drives. */
export type ViroSpecsAnimationTarget =
  | "transform.position.x"
  | "transform.position.y"
  | "transform.position.z"
  | "transform.scale.x"
  | "transform.scale.y"
  | "transform.scale.z"
  | "transform.rotation.x"
  | "transform.rotation.y"
  | "transform.rotation.z"
  | "material.opacity";

/** One animated property, from the current value to an absolute target. */
export interface ViroSpecsAnimationTrack {
  readonly target: ViroSpecsAnimationTarget;
  readonly from: "current";
  readonly to: number;
}

/** Easing curves Specs plays without substitution. */
export type ViroSpecsEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

/** A resolved animation on one node. */
export interface ViroSpecsManifestAnimation {
  readonly nodeId: string;
  readonly name: string;
  readonly plan: {
    readonly engine: "AnimationPlayer";
    readonly backendPackage?: string;
    readonly durationSeconds: number;
    readonly delaySeconds: number;
    readonly easing: ViroSpecsEasing;
    readonly playbackMode: "single" | "loop";
    readonly completionEvent: string;
    /** At least one track. */
    readonly tracks: readonly ViroSpecsAnimationTrack[];
  };
}

/** Who produced a manifest. */
export interface ViroSpecsManifestGenerator {
  /** For example `viro-specs-compile`, `viro-specs-runtime` or `hand-written`. */
  readonly name: string;
  readonly version?: string;
}

/**
 * Manifest version 2: the single contract between the runtime compiler, the
 * static compiler and hand-written JSON on one side, and the Lens host, mock
 * hosts and previews on the other.
 *
 * Every array is present after {@linkcode parseSpecsManifest}. In a JSON file
 * only `version` and `nodes` are required; missing arrays read as empty.
 *
 * @see {@linkcode parseSpecsManifest}
 * @see {@linkcode migrateSpecsManifest}
 */
export interface ViroSpecsManifestV2 {
  readonly $schema?: string;
  readonly version: 2;
  readonly generator?: ViroSpecsManifestGenerator;
  /** Entry file the manifest was compiled from, relative to the working directory. */
  readonly source?: string;
  readonly nodes: readonly ViroSpecsManifestNode[];
  readonly polylines: readonly ViroSpecsManifestPolyline[];
  readonly lights: readonly ViroSpecsLight[];
  readonly materials: readonly ViroSpecsMaterial[];
  readonly interactions: readonly ViroSpecsManifestInteraction[];
  readonly animations: readonly ViroSpecsManifestAnimation[];
  /**
   * Spatial tokens and wearer preferences. Written by the compilers when a
   * premium component compiled; absent otherwise. The Lens host falls back
   * to its built-in copy of the default tokens when it is absent.
   */
  readonly theme?: ViroSpecsTheme;
}

/** Node kinds the scene protocol 1 wire format carries. */
export type ViroSpecsWireNodeKind = "group" | "text" | "image" | "model" | "panel";

/**
 * Node in a scene protocol 1 snapshot, the shape the Lens runtime's
 * `applySceneSnapshot` reads today. Also the node shape of manifest v1.
 */
export interface ViroSpecsWireNode {
  readonly id: string;
  readonly kind: ViroSpecsWireNodeKind;
  readonly parentId?: string;
  readonly position?: ViroSpecsVec3;
  readonly rotation?: ViroSpecsQuat;
  readonly scale?: ViroSpecsVec3;
  readonly source?: string;
  readonly text?: string;
  readonly visible?: boolean;
}

/** Scene protocol 1 snapshot, sent to the Lens runtime. */
export interface ViroSpecsWireSceneSnapshot {
  readonly version: 1;
  readonly nodes: readonly ViroSpecsWireNode[];
}

/**
 * Manifest version 1: the document `viro-specs-compile --format json` wrote
 * before manifest v2. Deprecated; read it with {@linkcode parseSpecsManifest}
 * or convert it with {@linkcode migrateSpecsManifest}.
 *
 * A bare {@linkcode ViroSpecsWireSceneSnapshot} is also accepted as v1.
 *
 * @deprecated Use {@linkcode ViroSpecsManifestV2}.
 */
export interface ViroSpecsManifestV1 {
  readonly version: 1;
  readonly source?: string;
  readonly scene: ViroSpecsWireSceneSnapshot;
  readonly polylines?: readonly ViroSpecsManifestPolyline[];
  readonly interactions?: readonly ViroSpecsManifestInteraction[];
  readonly animations?: readonly ViroSpecsManifestAnimation[];
  /** v1 compilers wrote diagnostic strings here. Ignored on migration. */
  readonly diagnostics?: readonly string[];
}

/** The current manifest version. */
export const VIRO_SPECS_MANIFEST_VERSION = 2;

/**
 * Scene protocol of {@linkcode ViroSpecsWireSceneSnapshot}. Transports that
 * only implement `applyScene` receive this; fields it cannot carry are
 * reported with `VS1015`.
 */
export const VIRO_SPECS_SCENE_PROTOCOL_VERSION = 1;

/**
 * Scene protocol of {@linkcode ViroSpecsSceneDocument}, read by
 * `ViroSpecsSceneController` in `@viro-external/specs` (wire types
 * `ViroSpecsSceneDocumentV2`). It carries every node field of manifest v2,
 * plus lights and materials, so nothing is lowered away.
 */
export const VIRO_SPECS_SCENE_DOCUMENT_PROTOCOL_VERSION = 2;

/** Node kinds scene protocol 2 carries. Video and sound fail validation first. */
export type ViroSpecsSceneDocumentNode = Exclude<ViroSpecsManifestNode, ViroSpecsVideoNode | ViroSpecsSoundNode>;

/**
 * Scene protocol 2 document: a manifest v2 without authoring metadata
 * (`$schema`, `generator`, `source`). Built by
 * {@linkcode toSpecsSceneDocument}.
 */
export interface ViroSpecsSceneDocument {
  readonly version: 2;
  readonly nodes: readonly ViroSpecsSceneDocumentNode[];
  readonly polylines: readonly ViroSpecsManifestPolyline[];
  readonly lights: readonly ViroSpecsLight[];
  readonly materials: readonly ViroSpecsMaterial[];
  readonly interactions: readonly ViroSpecsManifestInteraction[];
  readonly animations: readonly ViroSpecsManifestAnimation[];
  readonly theme?: ViroSpecsTheme;
}

/** `$id` of the published v2 schema. */
export const VIRO_SPECS_MANIFEST_SCHEMA_ID =
  "https://github.com/mikevocalz/viro/blob/main/schemas/viro-specs-manifest.v2.json";
