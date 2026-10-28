import { toSpecsSceneDocument } from "./lower";
import type { ViroSpecsManifestV2, ViroSpecsSceneDocument } from "./manifest";

/**
 * Key order per object kind in a serialized manifest. Keys not listed sort
 * alphabetically after the listed ones.
 */
const ORDER = {
  top: ["$schema", "version", "generator", "source", "nodes", "polylines", "lights", "materials", "interactions", "animations"],
  generator: ["name", "version"],
  node: [
    "id", "kind", "parentId", "position", "rotation", "scale", "visible", "opacity", "materialId",
    "text", "style", "extents", "maxLines", "source", "format", "loop", "muted", "volume",
  ],
  polyline: ["id", "primitive", "backendPackage", "points", "radiusMeters", "materialId"],
  light: ["id", "type", "parentId", "color", "intensity", "position", "direction", "innerAngle", "outerAngle"],
  material: ["id", "color", "opacity", "texture", "lightingModel"],
  interaction: ["nodeId", "interactable", "manipulation", "events"],
  animation: ["nodeId", "name", "plan"],
  plan: ["engine", "backendPackage", "durationSeconds", "delaySeconds", "easing", "playbackMode", "completionEvent", "tracks"],
  track: ["target", "from", "to"],
  style: ["fontFamily", "fontSize", "fontWeight", "fontStyle", "color", "textAlign", "textAlignVertical"],
  extents: ["width", "height"],
} as const;

type OrderKind = keyof typeof ORDER;

/** Which order applies to the value under `key` inside an object of kind `parent`. */
function childKind(parent: OrderKind, key: string): OrderKind | undefined {
  switch (parent) {
    case "top":
      switch (key) {
        case "generator":
          return "generator";
        case "nodes":
          return "node";
        case "polylines":
          return "polyline";
        case "lights":
          return "light";
        case "materials":
          return "material";
        case "interactions":
          return "interaction";
        case "animations":
          return "animation";
        default:
          return undefined;
      }
    case "node":
      return key === "style" ? "style" : key === "extents" ? "extents" : undefined;
    case "animation":
      return key === "plan" ? "plan" : undefined;
    case "plan":
      return key === "tracks" ? "track" : undefined;
    default:
      return undefined;
  }
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonical(value: unknown, kind: OrderKind | undefined): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonical(entry, kind));
  if (!isPlainObject(value)) return value;
  const order: readonly string[] = kind ? ORDER[kind] : [];
  const keys = Object.keys(value).filter((key) => value[key] !== undefined);
  const known = order.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !order.includes(key)).sort();
  const out: Record<string, unknown> = {};
  for (const key of [...known, ...rest]) {
    out[key] = canonical(value[key], kind ? childKind(kind, key) : undefined);
  }
  return out;
}

/**
 * A copy of `manifest` with every object's keys in the canonical order
 * {@linkcode serializeSpecsManifest} writes.
 */
export function canonicalizeSpecsManifest(manifest: ViroSpecsManifestV2): ViroSpecsManifestV2 {
  // canonical() only reorders keys, so the result has the manifest's shape.
  return canonical(manifest, "top") as ViroSpecsManifestV2;
}

/**
 * Serializes a manifest with a fixed key order, two-space indentation and a
 * trailing newline. Both compilers write manifests through this, so two
 * manifests with the same content are byte-identical no matter in which order
 * a compiler set their fields.
 */
export function serializeSpecsManifest(manifest: ViroSpecsManifestV2): string {
  return JSON.stringify(canonicalizeSpecsManifest(manifest), null, 2) + "\n";
}

/**
 * The scene protocol 2 document for `manifest`, built from the canonical
 * manifest so its nodes, lights and animations have the same key order
 * {@linkcode serializeSpecsManifest} writes. `viro-specs-compile --format
 * scene-json` and the generated Lens host embed this document.
 *
 * @see {@linkcode toSpecsSceneDocument}
 */
export function canonicalSpecsSceneDocument(manifest: ViroSpecsManifestV2): ViroSpecsSceneDocument {
  return toSpecsSceneDocument(canonicalizeSpecsManifest(manifest));
}

/**
 * Serializes the scene protocol 2 document for `manifest` with two-space
 * indentation and a trailing newline, for `--format scene-json`.
 *
 * @see {@linkcode canonicalSpecsSceneDocument}
 */
export function serializeSpecsSceneDocument(manifest: ViroSpecsManifestV2): string {
  return JSON.stringify(canonicalSpecsSceneDocument(manifest), null, 2) + "\n";
}

/**
 * The part of a manifest both compilers can produce: everything except
 * provenance. `generator` names the producer and `source` names the entry
 * file, which the runtime compiler never sees, so neither can match across
 * producers.
 *
 * @see {@linkcode serializeSpecsManifest}
 */
export function specsManifestSharedSubset(manifest: ViroSpecsManifestV2): ViroSpecsManifestV2 {
  const { generator: _generator, source: _source, ...shared } = manifest;
  return shared;
}
