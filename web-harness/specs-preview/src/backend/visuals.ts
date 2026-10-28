import {
  BoxGeometry,
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Material,
} from "three";
import { PLACEHOLDER_TINT } from "./lensSemantics";
import type { Rgba } from "./textLayout";

/** Marks a mesh whose material alpha an opacity animation drives (Lens `setOpacityRecursive`). */
export const ALPHA_TARGET = "viroAlphaTarget";

/** Sets a three.js material color from Lens RGBA (hex channels are sRGB). */
export function applyRgba(material: Material, rgba: Rgba): void {
  if ("color" in material && material.color && typeof material.color === "object" && "setRGB" in material.color) {
    (material as MeshBasicMaterial).color.setRGB(rgba[0], rgba[1], rgba[2], SRGBColorSpace);
  }
  material.opacity = rgba[3];
  material.transparent = true;
}

/** Unlit quad matching the Lens Image default material. `width`/`height` in cm before scaling. */
export function createImageSurface(widthCm: number, heightCm: number): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(widthCm, heightCm),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, side: DoubleSide })
  );
  mesh.name = "viro-image-surface";
  mesh.userData[ALPHA_TARGET] = true;
  return mesh;
}

/** Text quad; the rasterized texture and size are set by the backend. */
export function createTextMesh(): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: DoubleSide })
  );
  mesh.name = "viro-text";
  mesh.userData[ALPHA_TARGET] = true;
  return mesh;
}

/** Rounded rectangle, cm, centered on the origin. */
function roundedRect(widthCm: number, heightCm: number, radiusCm: number): Shape {
  const w = widthCm / 2;
  const h = heightCm / 2;
  const r = Math.min(radiusCm, w, h);
  const shape = new Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

/**
 * Rounded quad, cm, facing +Z, for experience-layer backings. `radiusFraction`
 * is the corner radius over the shorter side. Scale it to size it.
 */
export function createRoundedSurface(widthCm: number, heightCm: number, radiusFraction: number, name: string): Mesh {
  const mesh = new Mesh(
    new ShapeGeometry(roundedRect(widthCm, heightCm, Math.min(widthCm, heightCm) * radiusFraction), 8),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, side: DoubleSide })
  );
  mesh.name = name;
  mesh.userData[ALPHA_TARGET] = true;
  return mesh;
}

/**
 * Stand-in for the UI Kit Frame the Lens host instantiates from
 * `defaultPanelPrefab`, sized to the panel's `innerSize` (extents). Drawn a
 * millimeter behind the node so children at z >= 0 sit in front of it.
 */
export function createPanelSurface(widthCm: number, heightCm: number): Mesh {
  const mesh = new Mesh(
    new ShapeGeometry(roundedRect(widthCm, heightCm, Math.min(widthCm, heightCm) * 0.08), 8),
    new MeshBasicMaterial({ color: 0x1c2230, transparent: true, opacity: 0.86, depthWrite: false, side: DoubleSide })
  );
  mesh.name = "viro-panel-frame";
  mesh.position.z = -0.1;
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * The missing-asset box from `ViroSpecsLensSceneBackend.showPlaceholder`:
 * `width x height x depth` cm, tinted `PLACEHOLDER_TINT`. The edge lines are
 * a preview addition so the box reads against any background.
 */
export function createPlaceholder(widthCm: number, heightCm: number, depthCm: number): Mesh {
  const geometry = new BoxGeometry(widthCm, heightCm, depthCm);
  const material = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  applyRgba(material, PLACEHOLDER_TINT);
  const mesh = new Mesh(geometry, material);
  mesh.name = "viro-placeholder";
  const edges = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({ color: 0xd7dde8, transparent: true, opacity: 0.9 })
  );
  edges.name = "viro-placeholder-edges";
  edges.raycast = () => undefined;
  mesh.add(edges);
  return mesh;
}

/** Thin outline of a scroll window, cm. */
export function createScrollOutline(widthCm: number, heightCm: number): LineSegments {
  const outline = new LineSegments(
    new EdgesGeometry(new PlaneGeometry(widthCm, heightCm)),
    new LineBasicMaterial({ color: 0x8aa4c8, transparent: true, opacity: 0.6 })
  );
  outline.name = "viro-scroll-window";
  outline.raycast = () => undefined;
  return outline;
}
