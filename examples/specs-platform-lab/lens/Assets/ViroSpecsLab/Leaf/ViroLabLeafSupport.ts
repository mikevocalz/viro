import { awaitEventOnce, findSceneObjectByName, nextFrame, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { InteractorTriggerType } from "../../ViroSpecs/lens/ViroSpecsInteractionKit";
import type { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ViroSpecsSceneControllerHost } from "../../ViroSpecs/lens/ViroSpecsSceneControllerHost";
import { ViroGeneratedSceneHost } from "../../ViroSpecs/generated/ViroGeneratedSceneHost";
import type { ViroSpecsSceneDocumentV2 } from "../../ViroSpecs/lens/ViroSpecsProtocol";
import type { ViroSpecsHostDiagnostic } from "../../ViroSpecs/lens/ViroSpecsHostDiagnostics";
import { ViroSpecsActionsLab } from "../../ViroSpecsValidation/lens/ViroSpecsActionsLab";
import type { Interactable } from "../../ViroSpecs/lens/ViroSpecsInteractionKit";

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
  // WS4 Hello scene: the title is a PanelText on the SpatialPanel root.
  titleText: "Hello",
  // SpecsPlatformLab.tsx: root at [0, -0.22, -1.5] m, polyline points relative
  // to the root, all converted to Lens centimeters.
  rootWorldCm: [0, -22, -150] as const,
  linePointsWorldCm: [
    [-30, -42, -138],
    [0, -20, -138],
    [30, -30, -138],
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

/** Object the setup script's wire step creates for the typed-actions reference flow. */
export const ACTIONS_LAB = "ActionsLab";

/** Polls `ready` every 50 ms until it holds or `timeoutMs` passes; returns the last answer. */
export async function waitFor(ready: () => boolean, timeoutMs: number = 3000): Promise<boolean> {
  for (let waited = 0; waited < timeoutMs; waited += 50) {
    if (ready()) return true;
    await sleep(50);
  }
  return ready();
}

/**
 * Enables the disabled ActionsLab object and waits until its
 * ViroSpecsActionsLab has started the reference flow on the scene
 * controller and the list scene is committed.
 */
export async function startActionsLab(): Promise<ViroSpecsActionsLab> {
  await waitForGeneratedScene();
  const object = findSceneObjectByName(ACTIONS_LAB);
  expect(object).toBeTruthy();
  object.enabled = true;
  const lookup = (): ViroSpecsActionsLab | null =>
    object.getComponent(ViroSpecsActionsLab.getTypeName()) as ViroSpecsActionsLab | null;
  const started = await waitFor(() => {
    const candidate = lookup();
    return candidate !== null && candidate.state !== undefined && findSceneObjectByName("viro:list-title") !== null;
  });
  expect(started).toBe(true);
  const lab = lookup();
  expect(lab).toBeTruthy();
  // SIK binds one frame after commit.
  await settle();
  return lab as ViroSpecsActionsLab;
}

/** Disables ActionsLab again and presents the compiled Platform Lab scene. */
export async function stopActionsLab(): Promise<void> {
  const object = findSceneObjectByName(ACTIONS_LAB);
  if (object) object.enabled = false;
  await restoreGeneratedScene();
}

/** Collects host diagnostics while `body` runs. */
export async function recordDiagnostics(body: () => Promise<void>): Promise<ViroSpecsHostDiagnostic[]> {
  const seen: ViroSpecsHostDiagnostic[] = [];
  const subscription = controllerHost().addOnDiagnosticListener((d) => seen.push(d));
  try {
    await body();
  } finally {
    subscription.remove();
  }
  return seen;
}

/**
 * Hover then trigger, as a pinch. When the action the pinch fires navigates
 * away, the scene that held `target` is retired and the Interactable is
 * destroyed while LEAF's trigger is still finishing; LEAF then throws
 * "Object is null" from its last access to the target. That error is
 * expected only when the target is already destroyed, so it is swallowed in
 * that case alone and returned as `retired: true`; anything else is rethrown.
 */
export async function pinch(
  interactor: { hover(target: Interactable, ms: number): Promise<void>; trigger(target: Interactable): Promise<void> },
  target: Interactable
): Promise<{ retired: boolean }> {
  await interactor.hover(target, 100);
  try {
    await interactor.trigger(target);
    return { retired: false };
  } catch (error) {
    if (isNull(target)) return { retired: true };
    throw error;
  }
}

/** One line per object under `object`: indented names plus the Text string where there is one. */
export function describeTree(object: SceneObject | null, depth: number = 0): string {
  if (!object) return "(none)";
  const text = object.getComponent("Component.Text") as Text | null;
  let out = "  ".repeat(depth) + object.name + (text ? ' "' + text.text + '"' : "") + "\n";
  for (let i = 0; i < object.getChildrenCount(); i++) out += describeTree(object.getChild(i), depth + 1);
  return out;
}

/**
 * The reference-flow card nearest the middle of the list's scroll window. A
 * card scrolled out of the window cannot be hovered, so scenarios pinch this
 * one. Positions come from the controller's node handles; a card's own
 * object is renamed viro-interactable:<id> when its interaction binds.
 */
export function visibleCard(lab: ViroSpecsActionsLab): { id: string; title: string; distanceMeters: number } {
  const scrollObject = findSceneObjectByName("viro-scroll:exhibit-list");
  expect(scrollObject).toBeTruthy();
  const windowY = scrollObject.getTransform().getWorldPosition().y;
  const host = controllerHost();
  const exhibits = lab.state?.exhibits ?? [];
  let picked = exhibits[0];
  let bestDy = Number.POSITIVE_INFINITY;
  for (const exhibit of exhibits) {
    const object = host.getNode("card-" + exhibit.id);
    if (!object) continue;
    const dy = Math.abs(object.getTransform().getWorldPosition().y - windowY);
    if (dy < bestDy) {
      bestDy = dy;
      picked = exhibit;
    }
  }
  expect(picked).toBeTruthy();
  print("VIRO_LAB_LEAF visible card-" + picked.id + " dy=" + bestDy);
  return picked;
}

/** BaseLeafInteractor members dragFrames drives; protected or private in LEAF 2.0.2. */
type LeafDragInternals = {
  startPoint: vec3;
  endPoint: vec3;
  overrideTrigger: InteractorTriggerType;
  overrideDragVector: vec3 | undefined;
  enterHover(target: Interactable): Promise<void>;
  exitHover(): Promise<void>;
  resetStartEndPoint(): void;
};

/**
 * Drags `target` for exactly `frames` drag updates, adding `vector` (cm)
 * to the interactor ray on each. Returns the number of updates SIK reported.
 *
 * LEAF's drag(target, vector, durationMs) does the same step but loops until
 * the wall-clock duration passes, so the distance depends on the Preview frame
 * rate: a normal Preview gets about 15 updates in 400 ms, a busy one gets 1
 * (viro_lab_drag moved 0.456 cm in ws4-03-leaf-existing). Counting updates
 * makes the drag the same length on every run.
 */
export async function dragFrames(interactor: DefaultLeafInteractor, target: Interactable, vector: vec3, frames: number): Promise<number> {
  const self = interactor as unknown as LeafDragInternals;
  let updates = 0;
  const unsubscribe = target.onDragUpdate.add(() => {
    if (updates < frames) {
      self.startPoint = self.startPoint.add(vector);
      self.endPoint = self.endPoint.add(vector);
    }
    updates++;
  });
  const dragStarted = awaitEventOnce(target.onDragStart);
  const dragEnded = awaitEventOnce(target.onDragEnd);
  await self.enterHover(target);
  await nextFrame();
  await nextFrame();
  self.overrideTrigger = InteractorTriggerType.Select;
  await nextFrame();
  self.overrideDragVector = vector;
  await dragStarted;
  while (updates < frames) await awaitEventOnce(target.onTriggerUpdate);
  unsubscribe();
  self.overrideTrigger = InteractorTriggerType.None;
  await dragEnded;
  self.resetStartEndPoint();
  self.overrideDragVector = undefined;
  await self.exitHover();
  return updates;
}
