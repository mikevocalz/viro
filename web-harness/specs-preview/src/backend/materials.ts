import { MeshStandardMaterial, type Material, type Texture } from "three";
import type { ViroSpecsDocumentMaterial } from "../vendor/lens-core/ViroSpecsProtocol";
import { parseViroSpecsColor } from "../vendor/lens-core/ViroSpecsSceneDocument";
import type { Rgba } from "./textLayout";
import type { PreviewMaterial } from "./types";
import { applyRgba } from "./visuals";

/**
 * Builds the owned material for a manifest definition the way
 * `ViroSpecsLensSceneBackend.createMaterial` does: base color from `color`,
 * alpha `color alpha * opacity`, `texture` as the base texture.
 *
 * `lightingModel` is not mapped: the Lens host clones one base material
 * whatever the model and reports VS5012, so the preview uses one lit
 * material for every definition too.
 */
export function createPreviewMaterial(definition: ViroSpecsDocumentMaterial, texture: Texture | null): PreviewMaterial {
  const rgba = definition.color !== undefined ? parseViroSpecsColor(definition.color) : ([1, 1, 1, 1] as const);
  const baseColor: Rgba = [rgba[0], rgba[1], rgba[2], rgba[3] * (definition.opacity ?? 1)];
  const template = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  template.name = "viro-owned:material:" + definition.id;
  applyRgba(template, baseColor);
  if (texture) template.map = texture;
  return { id: definition.id, owned: true, definition, baseColor, texture, template, disposed: false };
}

/**
 * A material the app registers with the preview by ID, the counterpart of a
 * Material in the Lens asset registry. Borrowed: the controller never
 * disposes it.
 */
export function createRegisteredMaterial(id: string, rgba: Rgba, texture: Texture | null = null): PreviewMaterial {
  const template = new MeshStandardMaterial({ roughness: 0.5 });
  template.name = "viro-registry:" + id;
  applyRgba(template, rgba);
  if (texture) template.map = texture;
  return { id, owned: false, baseColor: rgba, texture, template, disposed: false };
}

/** Per-node clone, named so a later swap can tell its own clone from a shared material. */
export function cloneForNode(material: Material, nodeId: string): Material {
  const clone = material.clone();
  clone.name = nodeMaterialName(nodeId);
  return clone;
}

/** Name of a material clone that belongs to one node only (Lens `nodeMaterialName`). */
export function nodeMaterialName(nodeId: string): string {
  return "viro-node:" + nodeId;
}
