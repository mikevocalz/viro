import type { AnimationClip, Group, Material, Mesh, Object3D, Plane, Texture } from "three";
import type { Line2 } from "three/addons/lines/Line2.js";
import type { ViroSpecsDocumentInteraction, ViroSpecsDocumentLight, ViroSpecsDocumentMaterial, ViroSpecsScroll } from "../vendor/lens-core/ViroSpecsProtocol";
import type { ViroSpecsBackendInteraction, ViroSpecsScrollRows } from "../vendor/lens-core/ViroSpecsSceneBackend";
import type { ViroSpecsHostNode } from "../vendor/lens-core/ViroSpecsSceneDocument";
import type { Rgba, TextLayout } from "./textLayout";

/** Kinds of handle the preview backend creates. */
export type PreviewNodeKind = ViroSpecsHostNode["kind"] | "root" | "light" | "polyline";

/**
 * Backend handle for one controller node: the three.js counterpart of the
 * Lens backend's `ViroSpecsLensNode`. `object` carries the node transform in
 * centimeters; visuals hang off it as children so the transform keeps its
 * manifest values.
 */
export interface PreviewNode {
  readonly id: string;
  readonly kind: PreviewNodeKind;
  readonly object: Group;
  /** Where children attach: the scroll content anchor for scroll groups. */
  contentParent?: Group;
  text?: { layout: TextLayout; mesh: Mesh; tint: Rgba | undefined };
  /** Image quad; its scale carries the extents. */
  imageSurface?: Mesh;
  /** Panel frame quad sized by extents. */
  panelSurface?: Mesh;
  model?: { root: Object3D; source: string };
  placeholder?: { mesh: Mesh; widthCm: number; heightCm: number; depthCm: number };
  /**
   * Scroll window. `normalized` is ScrollWindow's: y is 1 at the content top
   * and -1 at the bottom. `clipPlanes` are world-space, updated each frame.
   */
  scroll?: { spec: ViroSpecsScroll; normalized: [number, number]; outline: Object3D; clipPlanes: Plane[]; rows: ViroSpecsScrollRows | undefined };
  /** Text fill before opacity, Lens `textColor`. */
  textColor?: Rgba;
  /** Last opacity set; re-applied after a material or asset swap. */
  opacity?: number;
  /** Material from `setMaterial`, or null for the backend default. */
  material?: PreviewMaterial | null;
  /** Source ID of the bound image texture. */
  imageSource?: string;
  light?: { spec: ViroSpecsDocumentLight; light: Object3D };
  polyline?: { line: Line2; widthCm: number; pointsCm: readonly (readonly [number, number, number])[]; material: PreviewMaterial | null };
  interaction?: { spec: ViroSpecsDocumentInteraction; emit: (event: ViroSpecsBackendInteraction) => void };
  alive: boolean;
}

/** Loaded asset: a texture for images, a glTF scene for models. */
export type PreviewAsset =
  | { readonly kind: "texture"; readonly source: string; readonly texture: Texture }
  | { readonly kind: "model"; readonly source: string; readonly scene: Object3D; readonly animations: readonly AnimationClip[] };

/**
 * A material the controller resolved: either built from a manifest
 * definition (owned) or registered with the preview (borrowed).
 */
export interface PreviewMaterial {
  readonly id: string;
  readonly owned: boolean;
  readonly definition?: ViroSpecsDocumentMaterial;
  /** RGBA the Lens host writes to `mainPass.baseColor`. */
  readonly baseColor: Rgba;
  readonly texture: Texture | null;
  /** Template the backend clones per node, as Lens clones materials per visual. */
  readonly template: Material;
  disposed: boolean;
}
