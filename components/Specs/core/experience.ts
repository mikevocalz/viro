import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic } from "./diagnostic";
import type {
  ViroSpecsManifestNode,
  ViroSpecsManifestV2,
  ViroSpecsQuat,
  ViroSpecsVec3,
} from "./manifest";
import { multiplySpecsQuaternions, rotateSpecsPoint } from "./transform";
import { specsMetersToAngle, VIRO_SPECS_SPATIAL_TOKENS, type ViroSpecsSpatialTokens } from "./tokens";

/**
 * Lens Text em-square height per Viro `fontSize` point, in meters. The Lens
 * host passes `fontSize` through as Lens Text `size` (one Lens size unit per
 * point), and a Lens Text `size` of 43.886 draws a 1 cm em square
 * (ls-clad `specs-build-ui` type scale). 48 points is therefore 1.09 cm.
 */
export const VIRO_SPECS_TEXT_EM_METERS_PER_POINT = 0.01 / 43.886;

/** Lens Text size the host uses when a text node has no `fontSize`. */
export const VIRO_SPECS_DEFAULT_TEXT_POINTS = 48;

/**
 * A surface whose largest side subtends at least this angle counts as large
 * for the no-vection rule (`VS3021`). Half the 20 degree panel width in the
 * handoff docs. A starting value, not a measured threshold.
 */
export const VIRO_SPECS_LARGE_SURFACE_DEG = 10;

/** Rounding slack for the comparisons below. */
const EPSILON = 1e-6;

/** World transform of one manifest node. */
interface WorldPose {
  readonly position: ViroSpecsVec3;
  readonly rotation: ViroSpecsQuat;
  readonly scale: ViroSpecsVec3;
}

const ROOT_POSE: WorldPose = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };

function length(v: ViroSpecsVec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * World poses for every node, composed through `parentId`. Nodes in a parent
 * cycle or under a missing parent get no pose; validation reports those.
 *
 * Children of a `scroll` group are placed as the Lens host shows them with
 * the list at its top: their `y = 0` is the window's top edge, half the
 * window height above the group origin.
 */
export function specsWorldPoses(nodes: readonly ViroSpecsManifestNode[]): ReadonlyMap<string, WorldPose> {
  const byId = new Map<string, ViroSpecsManifestNode>();
  for (const node of nodes) byId.set(node.id, node);
  const poses = new Map<string, WorldPose>();
  const visiting = new Set<string>();

  const poseOf = (node: ViroSpecsManifestNode): WorldPose | undefined => {
    const known = poses.get(node.id);
    if (known) return known;
    if (visiting.has(node.id)) return undefined;
    visiting.add(node.id);
    let parent: WorldPose | undefined = ROOT_POSE;
    if (node.parentId !== undefined) {
      const parentNode = byId.get(node.parentId);
      parent = parentNode ? poseOf(parentNode) : undefined;
    }
    visiting.delete(node.id);
    if (!parent) return undefined;
    const authored = node.position ?? [0, 0, 0];
    const parentNode = node.parentId !== undefined ? byId.get(node.parentId) : undefined;
    const contentTop = parentNode?.kind === "group" && parentNode.scroll !== undefined ? parentNode.scroll.height / 2 : 0;
    const local: ViroSpecsVec3 = [authored[0], authored[1] + contentTop, authored[2]];
    const rotated = rotateSpecsPoint(parent.rotation, [
      local[0] * parent.scale[0],
      local[1] * parent.scale[1],
      local[2] * parent.scale[2],
    ]);
    const scale = node.scale ?? [1, 1, 1];
    const pose: WorldPose = {
      position: [parent.position[0] + rotated[0], parent.position[1] + rotated[1], parent.position[2] + rotated[2]],
      rotation: multiplySpecsQuaternions(parent.rotation, node.rotation ?? [0, 0, 0, 1]),
      scale: [parent.scale[0] * scale[0], parent.scale[1] * scale[1], parent.scale[2] * scale[2]],
    };
    poses.set(node.id, pose);
    return pose;
  };
  for (const node of nodes) poseOf(node);
  return poses;
}

function isRendered(node: ViroSpecsManifestNode): boolean {
  return node.kind === "text" || node.kind === "image" || node.kind === "model" || node.kind === "panel";
}

function fieldPathOf(manifest: ViroSpecsManifestV2, nodeId: string, field: string): string {
  const index = manifest.nodes.findIndex((node) => node.id === nodeId);
  return "/nodes/" + index + "/" + field;
}

function round(value: number, digits: number): string {
  return value.toFixed(digits);
}

/**
 * Comfort and accessibility checks on a manifest v2, from the WS4 rules in
 * `docs/specs-experience.md`:
 *
 * - `VS3016` an interactable node has no `label`;
 * - `VS3017` a rendered node sits nearer than 0.6 m or farther than 3.0 m
 *   from the wearer;
 * - `VS3018` text is smaller than 1.2 degrees at its distance;
 * - `VS3019` an animation runs longer than 500 ms;
 * - `VS3020` an animation does not ease in and out;
 * - `VS3021` an animation moves a surface 10 degrees or wider.
 *
 * The wearer is assumed at the scene origin, which is where the Lens camera
 * starts when the generated host places the scene root. All findings are
 * warnings: the manifest is faithful, the experience is not comfortable.
 * `viro-specs-compile --strict` fails on them.
 *
 * `tokens` defaults to the manifest theme, then to the default tokens.
 */
export function checkSpecsExperience(
  manifest: ViroSpecsManifestV2,
  tokens: ViroSpecsSpatialTokens = manifest.theme?.tokens ?? VIRO_SPECS_SPATIAL_TOKENS
): ViroSpecsDiagnostic[] {
  const diagnostics: ViroSpecsDiagnostic[] = [];
  const byId = new Map<string, ViroSpecsManifestNode>();
  for (const node of manifest.nodes) byId.set(node.id, node);
  const poses = specsWorldPoses(manifest.nodes);
  const band = tokens.distance;

  // VS3016: labels on interactables.
  manifest.interactions.forEach((interaction, index) => {
    const node = byId.get(interaction.nodeId);
    if (!node) return;
    if (node.label === undefined || node.label.trim() === "") {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3016",
          "Node " + JSON.stringify(node.id) + " responds to " + interaction.events.join(", ") + " but has no label.",
          { nodeId: node.id, fieldPath: "/interactions/" + index }
        )
      );
    }
  });

  // VS3017 and VS3018: distance band and angular text size.
  for (const node of manifest.nodes) {
    if (!isRendered(node)) continue;
    const pose = poses.get(node.id);
    if (!pose) continue;
    const distance = length(pose.position);
    if (distance < band.minMeters - EPSILON || distance > band.maxMeters + EPSILON) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3017",
          "Node " + JSON.stringify(node.id) + " is " + round(distance, 2) + " m from the wearer; the band is " + band.minMeters + "-" + band.maxMeters + " m.",
          { nodeId: node.id, fieldPath: fieldPathOf(manifest, node.id, "position") }
        )
      );
    }
    if (node.kind === "text" && distance > EPSILON) {
      const points = node.style?.fontSize ?? VIRO_SPECS_DEFAULT_TEXT_POINTS;
      const emMeters = points * VIRO_SPECS_TEXT_EM_METERS_PER_POINT * Math.abs(pose.scale[1]);
      const angle = specsMetersToAngle(emMeters, distance);
      if (angle < tokens.type.minAngleDeg - EPSILON) {
        diagnostics.push(
          createViroSpecsDiagnostic(
            "VS3018",
            "Text " + JSON.stringify(node.id) + " is " + round(angle, 2) + " degrees tall at " + round(distance, 2) + " m (fontSize " + points + "); the minimum is " + tokens.type.minAngleDeg + " degrees.",
            { nodeId: node.id, fieldPath: fieldPathOf(manifest, node.id, node.style?.fontSize !== undefined ? "style/fontSize" : "style") }
          )
        );
      }
    }
  }

  // VS3019, VS3020, VS3021: animation timing, easing and vection.
  const maxSeconds = tokens.motion.maxMs / 1000;
  manifest.animations.forEach((animation, index) => {
    const at = "/animations/" + index + "/plan";
    const plan = animation.plan;
    if (plan.durationSeconds > maxSeconds + EPSILON) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3019",
          "Animation " + JSON.stringify(animation.name) + " on " + JSON.stringify(animation.nodeId) + " runs " + Math.round(plan.durationSeconds * 1000) + " ms; the cap is " + tokens.motion.maxMs + " ms.",
          { nodeId: animation.nodeId, fieldPath: at + "/durationSeconds" }
        )
      );
    }
    if (plan.easing !== "ease-in-out") {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3020",
          "Animation " + JSON.stringify(animation.name) + " on " + JSON.stringify(animation.nodeId) + " uses " + plan.easing + ".",
          { nodeId: animation.nodeId, fieldPath: at + "/easing" }
        )
      );
    }
    const node = byId.get(animation.nodeId);
    if (!node) return;
    const local = node.position ?? [0, 0, 0];
    const moves = plan.tracks.some((track) => {
      const current =
        track.target === "transform.position.x"
          ? local[0]
          : track.target === "transform.position.y"
            ? local[1]
            : track.target === "transform.position.z"
              ? local[2]
              : undefined;
      return current !== undefined && Math.abs(track.to - current) > EPSILON;
    });
    if (!moves) return;
    const surface = largestSurfaceAngle(node, manifest.nodes, poses);
    if (surface.angle >= VIRO_SPECS_LARGE_SURFACE_DEG - EPSILON) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3021",
          "Animation " + JSON.stringify(animation.name) + " moves " + JSON.stringify(animation.nodeId) + ", which carries surface " + JSON.stringify(surface.nodeId) + " " + round(surface.angle, 1) + " degrees wide.",
          { nodeId: animation.nodeId, fieldPath: at + "/tracks" }
        )
      );
    }
  });

  return diagnostics;
}

/** Largest angular extent among `root` and its descendants that have extents. */
function largestSurfaceAngle(
  root: ViroSpecsManifestNode,
  nodes: readonly ViroSpecsManifestNode[],
  poses: ReadonlyMap<string, WorldPose>
): { readonly angle: number; readonly nodeId: string } {
  const children = new Map<string, ViroSpecsManifestNode[]>();
  for (const node of nodes) {
    if (node.parentId === undefined) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }
  let best = { angle: 0, nodeId: root.id };
  const stack: ViroSpecsManifestNode[] = [root];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    const pose = poses.get(node.id);
    const extents = "extents" in node ? node.extents : undefined;
    if (pose && extents) {
      const side = Math.max(extents.width * Math.abs(pose.scale[0]), extents.height * Math.abs(pose.scale[1]));
      const angle = specsMetersToAngle(side, Math.max(length(pose.position), EPSILON));
      if (angle > best.angle) best = { angle, nodeId: node.id };
    }
    for (const child of children.get(node.id) ?? []) stack.push(child);
  }
  return best;
}

/** Codes {@linkcode checkSpecsExperience} emits. */
export const VIRO_SPECS_EXPERIENCE_CODES = ["VS3016", "VS3017", "VS3018", "VS3019", "VS3020", "VS3021"] as const;

/**
 * Drops comfort and accessibility findings. For tests and tools that check
 * something else on a minimal scene (often at the origin) and must not depend
 * on the comfort rules.
 */
export function withoutSpecsExperienceFindings<T extends { readonly code: string }>(diagnostics: readonly T[]): T[] {
  const codes: readonly string[] = VIRO_SPECS_EXPERIENCE_CODES;
  return diagnostics.filter((diagnostic) => !codes.includes(diagnostic.code));
}
