import { Vector3, type Mesh } from "three";
import type { ThreeSceneBackend } from "./backend/ThreeSceneBackend";
import type { PreviewNode } from "./backend/types";

/** One live node of the preview scene graph, in Lens units. */
export interface PreviewGraphEntry {
  readonly id: string;
  readonly kind: PreviewNode["kind"];
  /** ID of the parent handle (`viro-scene:<revision>` for top-level nodes). */
  readonly parentId: string;
  readonly visible: boolean;
  /** Local transform: centimeters, `[x, y, z, w]`, scale. */
  readonly positionCm: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
  readonly worldPositionCm: readonly [number, number, number];
  readonly opacity?: number;
  readonly text?: { readonly text: string; readonly size: number; readonly color: readonly number[]; readonly rectCm: readonly [number, number]; readonly lines: readonly string[] };
  /** Rendered image or panel size, cm. */
  readonly surfaceCm?: readonly [number, number];
  readonly imageSource?: string;
  readonly modelSource?: string;
  readonly placeholderCm?: readonly [number, number, number];
  readonly material?: { readonly id: string; readonly owned: boolean; readonly baseColor: readonly number[] };
  readonly light?: { readonly type: string; readonly intensity: number };
  readonly polyline?: { readonly pointsCm: readonly (readonly number[])[]; readonly widthCm: number };
  readonly interactable?: { readonly events: readonly string[]; readonly manipulation: boolean };
  readonly scrollNormalized?: readonly [number, number];
}

const round = (v: number): number => Math.round(v * 1e4) / 1e4;
const r3 = (v: { x: number; y: number; z: number }): [number, number, number] => [round(v.x), round(v.y), round(v.z)];

/** Snapshot of every live node the backend holds, sorted by ID. */
export function describePreviewGraph(backend: ThreeSceneBackend): PreviewGraphEntry[] {
  const handles = backend.liveHandles();
  const byObject = new Map(handles.map((h) => [h.object, h]));
  const parentOf = (node: PreviewNode): string => {
    let o = node.object.parent;
    while (o) {
      const h = byObject.get(o as PreviewNode["object"]);
      if (h) return h.id;
      o = o.parent;
    }
    return "";
  };
  return handles
    .filter((h) => h.kind !== "root")
    .map((h): PreviewGraphEntry => {
      h.object.updateWorldMatrix(true, false);
      const q = h.object.quaternion;
      const surface = h.imageSurface ?? h.panelSurface;
      const entry: PreviewGraphEntry = {
        id: h.id,
        kind: h.kind,
        parentId: parentOf(h),
        visible: h.object.visible,
        positionCm: r3(h.object.position),
        rotation: [round(q.x), round(q.y), round(q.z), round(q.w)],
        scale: r3(h.object.scale),
        worldPositionCm: r3(h.object.getWorldPosition(new Vector3())),
        ...(h.opacity !== undefined ? { opacity: h.opacity } : {}),
        ...(h.text
          ? {
              text: {
                text: h.text.layout.text,
                size: h.text.layout.size,
                color: h.text.layout.color.map(round),
                rectCm: [round(h.text.layout.rectWidthCm), round(h.text.layout.rectHeightCm)] as const,
                lines: h.text.layout.lines,
              },
            }
          : {}),
        ...(surface ? { surfaceCm: surfaceSize(surface) } : {}),
        ...(h.imageSource !== undefined ? { imageSource: h.imageSource } : {}),
        ...(h.model ? { modelSource: h.model.source } : {}),
        ...(h.placeholder ? { placeholderCm: [round(h.placeholder.widthCm), round(h.placeholder.heightCm), round(h.placeholder.depthCm)] as const } : {}),
        ...(h.material ? { material: { id: h.material.id, owned: h.material.owned, baseColor: h.material.baseColor.map(round) } } : {}),
        ...(h.polyline?.material ? { material: { id: h.polyline.material.id, owned: h.polyline.material.owned, baseColor: h.polyline.material.baseColor.map(round) } } : {}),
        ...(h.light ? { light: { type: h.light.spec.type, intensity: round((h.light.light as unknown as { intensity: number }).intensity) } } : {}),
        ...(h.polyline ? { polyline: { pointsCm: h.polyline.pointsCm.map((p) => p.map(round)), widthCm: round(h.polyline.widthCm) } } : {}),
        ...(h.interaction ? { interactable: { events: [...h.interaction.spec.events], manipulation: h.interaction.spec.manipulation } } : {}),
        ...(h.scroll ? { scrollNormalized: h.scroll.normalized } : {}),
      };
      return entry;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Width and height of a surface quad after its scale, cm. */
function surfaceSize(mesh: Mesh): [number, number] {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return [0, 0];
  return [round((box.max.x - box.min.x) * mesh.scale.x), round((box.max.y - box.min.y) * mesh.scale.y)];
}
