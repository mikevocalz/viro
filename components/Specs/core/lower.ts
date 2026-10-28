import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic } from "./diagnostic";
import type {
  ViroSpecsSceneDocument,
  ViroSpecsSceneDocumentNode,
  ViroSpecsManifestNode,
  ViroSpecsManifestV2,
  ViroSpecsWireNode,
  ViroSpecsWireSceneSnapshot,
} from "./manifest";

/** Output of {@linkcode toSpecsSceneSnapshot}. */
export interface ViroSpecsLoweredScene {
  readonly snapshot: ViroSpecsWireSceneSnapshot;
  /** One `VS1015` warning per manifest field the protocol cannot carry. */
  readonly diagnostics: readonly ViroSpecsDiagnostic[];
}

/**
 * Fields the wire carries, plus metadata that needs no wire field: `format`
 * describes the asset `source` already names, and the Lens asset registry
 * binds the asset, so leaving it off the wire changes nothing on screen.
 */
const CARRIED = new Set([
  "format",
  "id",
  "kind",
  "parentId",
  "position",
  "rotation",
  "scale",
  "source",
  "text",
  "visible",
]);

function lowerNode(
  node: ViroSpecsManifestNode,
  index: number,
  diagnostics: ViroSpecsDiagnostic[]
): ViroSpecsWireNode | undefined {
  if (node.kind === "video" || node.kind === "sound") {
    // Validation already reported VS4004/VS4005; there is nothing to send.
    return undefined;
  }
  const wire: { -readonly [K in keyof ViroSpecsWireNode]: ViroSpecsWireNode[K] } = {
    id: node.id,
    kind: node.kind,
  };
  if (node.parentId !== undefined) wire.parentId = node.parentId;
  if (node.position !== undefined) wire.position = node.position;
  if (node.rotation !== undefined) wire.rotation = node.rotation;
  if (node.scale !== undefined) wire.scale = node.scale;
  if ("source" in node) wire.source = node.source;
  if (node.kind === "text") wire.text = node.text;
  if (node.visible !== undefined) wire.visible = node.visible;

  for (const key of Object.keys(node)) {
    if (!CARRIED.has(key)) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS1015",
          "Node " + JSON.stringify(node.id) + " field `" + key + "` is kept in the manifest and omitted from the Lens snapshot.",
          { nodeId: node.id, fieldPath: "/nodes/" + index + "/" + key }
        )
      );
    }
  }
  return wire;
}

/**
 * Lowers a manifest v2 to the scene protocol 1 snapshot the Lens runtime
 * reads today. Fields the protocol does not carry (text style, extents,
 * opacity, materialId, lights) are reported with `VS1015`
 * instead of being dropped silently. Polylines, interactions and animations
 * already use their wire shapes and are sent unchanged.
 */
export function toSpecsSceneSnapshot(manifest: ViroSpecsManifestV2): ViroSpecsLoweredScene {
  const diagnostics: ViroSpecsDiagnostic[] = [];
  const nodes: ViroSpecsWireNode[] = [];
  manifest.nodes.forEach((node, index) => {
    const wire = lowerNode(node, index, diagnostics);
    if (wire) nodes.push(wire);
  });
  manifest.lights.forEach((light, index) => {
    diagnostics.push(
      createViroSpecsDiagnostic(
        "VS1015",
        "Light " + JSON.stringify(light.id) + " is kept in the manifest and not sent to the Lens runtime.",
        { nodeId: light.id, fieldPath: "/lights/" + index }
      )
    );
  });
  return { snapshot: { version: 1, nodes }, diagnostics };
}

/**
 * Builds the scene protocol 2 document the generated Lens host and
 * `ViroSpecsSceneController` read. Every manifest v2 node field, light and
 * material is carried, so unlike {@linkcode toSpecsSceneSnapshot} this
 * reports nothing. Video and sound nodes are left out; validation has
 * already rejected them with `VS4004`/`VS4005`.
 */
export function toSpecsSceneDocument(manifest: ViroSpecsManifestV2): ViroSpecsSceneDocument {
  const nodes = manifest.nodes.filter(
    (node): node is ViroSpecsSceneDocumentNode => node.kind !== "video" && node.kind !== "sound"
  );
  return {
    version: 2,
    nodes,
    polylines: manifest.polylines,
    lights: manifest.lights,
    materials: manifest.materials,
    interactions: manifest.interactions,
    animations: manifest.animations,
  };
}
