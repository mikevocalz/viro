import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ViroSpecsSceneControllerHost } from "../../ViroSpecs/lens/ViroSpecsSceneControllerHost";
import { ViroGeneratedSceneHost } from "../../ViroSpecs/generated/ViroGeneratedSceneHost";
import type { ViroSpecsSceneDocumentV2 } from "../../ViroSpecs/lens/ViroSpecsProtocol";

/**
 * Shared lookups for the generated Platform Lab scenarios.
 *
 * Node names come from the compiled scene (SpecsPlatformLab.tsx) and the
 * scene-controller backend: "viro:<id>", "viro-interactable:<id>",
 * "viro-line:<id>", "viro-line-point:<id>:<n>", "viro-placeholder:<id>",
 * "viro-scroll:<id>", and one "viro-scene:<revision>" root per committed scene.
 * Host objects are the ones scripts/specs-lens-setup.mjs creates.
 */
export const LAB = {
  root: "viro:platform-lab-root",
  title: "viro:platform-lab-title",
  model: "viro:platform-lab-model",
  modelInteractable: "viro-interactable:platform-lab-model",
  modelId: "platform-lab-model",
  routeId: "platform-lab-route",
  sceneHost: "SceneHost",
  generatedHost: "GeneratedHost",
  generatedContent: "ViroGeneratedContent",
  titleText: "Viro Cross-Platform Lab",
  // SpecsPlatformLab.tsx: root at [0, 0, -1.5] m, polyline points relative to
  // the root, all converted to Lens centimeters.
  rootWorldCm: [0, 0, -150] as const,
  linePointsWorldCm: [
    [-30, -20, -138],
    [0, 2, -138],
    [30, -8, -138],
  ] as const,
};

export type LabInteraction = { nodeId: string; phase: string; source: string };

export function controllerHost(): ViroSpecsSceneControllerHost {
  const object = findSceneObjectByName(LAB.sceneHost);
  expect(object).toBeTruthy();
  const host = object.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null;
  expect(host).toBeTruthy();
  return host as ViroSpecsSceneControllerHost;
}

/** Presents the compiled Platform Lab scene again, as the generated host does on start. */
export async function restoreGeneratedScene(): Promise<void> {
  const object = findSceneObjectByName(LAB.generatedHost);
  const generated = object.getComponent(ViroGeneratedSceneHost.getTypeName()) as ViroGeneratedSceneHost | null;
  expect(generated).toBeTruthy();
  generated.restartGeneratedScene();
  await waitForGeneratedScene();
}

/** The host applies the scene on OnStartEvent and binds SIK a frame later. */
export async function waitForGeneratedScene(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (findSceneObjectByName(LAB.root) && findSceneObjectByName(LAB.modelInteractable)) {
      await sleep(100);
      return;
    }
    await sleep(100);
  }
  expect(findSceneObjectByName(LAB.root)).toBeTruthy();
}

/** Waits one frame plus a margin so commit and SIK binding settle. */
export async function settle(ms: number = 200): Promise<void> {
  await sleep(ms);
}

export function textOf(name: string): string | undefined {
  const object = findSceneObjectByName(name);
  const text = object?.getComponent("Component.Text") as Text | null;
  return text?.text;
}

export function expectNear(actual: vec3, expected: readonly number[], toleranceCm: number): void {
  expect(Math.abs(actual.x - expected[0])).toBeLessThan(toleranceCm);
  expect(Math.abs(actual.y - expected[1])).toBeLessThan(toleranceCm);
  expect(Math.abs(actual.z - expected[2])).toBeLessThan(toleranceCm);
}

/** Line root and point names for the scene-controller backend. */
export function lineObject(): SceneObject {
  return findSceneObjectByName("viro-line:" + LAB.routeId);
}

export function linePointObject(index: number): SceneObject {
  return findSceneObjectByName("viro-line-point:" + LAB.routeId + ":" + index);
}

/** Records interaction events for one node from the scene controller while `body` runs. */
export async function recordInteractions(
  nodeId: string,
  body: () => Promise<void>
): Promise<LabInteraction[]> {
  const events: LabInteraction[] = [];
  const subscription = controllerHost().addOnInteractionListener((event) => {
    if (event.nodeId === nodeId) events.push({ nodeId: event.nodeId, phase: event.phase, source: event.source });
  });
  try {
    await body();
    await sleep(100);
  } finally {
    subscription.remove();
  }
  return events;
}

export function phases(events: readonly LabInteraction[]): string {
  return events.map((event) => event.phase).join(",");
}

/** Children of the generated-content root whose name starts with `prefix`. */
export function contentChildren(prefix: string): SceneObject[] {
  const content = findSceneObjectByName(LAB.generatedContent);
  const out: SceneObject[] = [];
  for (let i = 0; i < content.getChildrenCount(); i++) {
    const child = content.getChild(i);
    if (child.name.startsWith(prefix)) out.push(child);
  }
  return out;
}

/** Counts every scene object under the generated-content root, recursively. */
export function countDescendants(object: SceneObject): number {
  let total = 0;
  for (let i = 0; i < object.getChildrenCount(); i++) total += 1 + countDescendants(object.getChild(i));
  return total;
}

/** A protocol 2 document with every list present, as the controller requires. */
export function document(parts: Partial<ViroSpecsSceneDocumentV2> & { nodes: ViroSpecsSceneDocumentV2["nodes"] }): ViroSpecsSceneDocumentV2 {
  return {
    version: 2,
    nodes: parts.nodes,
    polylines: parts.polylines ?? [],
    lights: parts.lights ?? [],
    materials: parts.materials ?? [],
    interactions: parts.interactions ?? [],
    animations: parts.animations ?? [],
  };
}
