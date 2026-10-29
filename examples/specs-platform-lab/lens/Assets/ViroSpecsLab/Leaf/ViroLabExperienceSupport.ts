import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { findInteractableByName, findInteractables } from "Leaf.lspkg/Interactors/InteractableUtils";
import { Interactable } from "../../ViroSpecs/lens/ViroSpecsInteractionKit";
import { ViroSpecsExperienceHost } from "../../ViroSpecs/lens/ViroSpecsExperienceLensView";
import type { ViroSpecsExperienceController, ViroSpecsExperienceView } from "../../ViroSpecs/lens/ViroSpecsExperience";
import { ViroSpecsLensSceneBackend } from "../../ViroSpecs/lens/ViroSpecsLensSceneBackend";
import type { ViroSpecsHostDiagnostic } from "../../ViroSpecs/lens/ViroSpecsHostDiagnostics";
import type { ViroSpecsApplyResult } from "../../ViroSpecs/lens/ViroSpecsSceneController";
import { galleryScene, type ViroLabGalleryScene } from "../Gallery/ViroLabGallery";
import { VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE } from "../../ViroSpecs/lens/ViroSpecsExperienceTokens";
import { controllerHost, restoreGeneratedScene, waitFor, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * Shared steps for the WS4 experience scenarios (viro_ws4_*). The setup
 * script's wire step adds ExperienceHost (ViroSpecsExperienceHost on the
 * scene controller) disabled; each scenario enables it, presents one of the
 * four gallery documents viro compiled, and restores the generated scene.
 *
 * Objects the experience layer creates: "ViroSpecsExperienceOverlay",
 * "ViroSpecsExperience-<loading|notice|error|permission>" panels with
 * "title", "body", "detail" and "action" children, "ViroSpecsReticle",
 * "ViroSpecsDwell", and per premium node a "backing" plus a "label" or
 * "title" child.
 */
export const EXPERIENCE_HOST = "ExperienceHost";

/** Default parameters every WS4 scenario declares in the LEAF index. */
export const WS4_PARAMETERS: Record<string, string> = { hold_ms: "0" };

/** Enables ExperienceHost and waits until its controller is attached to the scene controller. */
export async function startExperience(inputs: { placementScene?: boolean; gazeOnly?: boolean } = {}): Promise<ViroSpecsExperienceHost> {
  await waitForGeneratedScene();
  configureExperience(inputs);
  const object = findSceneObjectByName(EXPERIENCE_HOST);
  expect(object).toBeTruthy();
  object.enabled = true;
  const lookup = (): ViroSpecsExperienceHost | null =>
    object.getComponent(ViroSpecsExperienceHost.getTypeName()) as ViroSpecsExperienceHost | null;
  expect(await waitFor(() => lookup()?.controller !== null && lookup()?.controller !== undefined)).toBe(true);
  const started = lookup() as ViroSpecsExperienceHost;
  print(
    "VIRO_WS4 experience started placementScene=" + started.placementScene +
      " panelMesh=" + (started.panelMesh ? started.panelMesh.name : "null") +
      " panelMaterial=" + (started.panelMaterial ? started.panelMaterial.name : "null")
  );
  return started;
}

/** Disables ExperienceHost and presents the compiled Platform Lab scene again. */
export async function stopExperience(): Promise<void> {
  const object = findSceneObjectByName(EXPERIENCE_HOST);
  if (object) object.enabled = false;
  await restoreGeneratedScene();
}

export function controllerOf(host: ViroSpecsExperienceHost): ViroSpecsExperienceController {
  const controller = host.controller;
  expect(controller).toBeTruthy();
  return controller as ViroSpecsExperienceController;
}

export function viewOf(host: ViroSpecsExperienceHost): ViroSpecsExperienceView {
  return controllerOf(host).view();
}

/** Presents a gallery document, after `edit` changes the copy. */
export function presentGallery(
  name: ViroLabGalleryScene,
  edit?: (doc: ReturnType<typeof galleryScene>) => void
): ViroSpecsApplyResult {
  const doc = galleryScene(name);
  if (edit) edit(doc);
  return controllerHost().present(doc);
}

/** The node object of a gallery document's node. */
export function nodeOf(doc: ReturnType<typeof galleryScene>, id: string): Record<string, unknown> {
  const node = doc.nodes.find((n) => n.id === id);
  expect(node).toBeTruthy();
  return node as Record<string, unknown>;
}

/** One of the experience layer's panels, or null before it first opened. */
export function panel(key: "loading" | "notice" | "error" | "permission"): SceneObject | null {
  return findSceneObjectByName("ViroSpecsExperience-" + key);
}

export function panelOpen(key: "loading" | "notice" | "error" | "permission"): boolean {
  const object = panel(key);
  return !!object && object.enabled;
}

/** One line describing the experience view and the overlay panels, for failure logs. */
export function describeExperience(host: ViroSpecsExperienceHost): string {
  const view = host.controller?.view();
  const panels = (["loading", "notice", "error", "permission"] as const)
    .map((key) => key + "=" + (panel(key) ? (panelOpen(key) ? "open" : "closed") : "none"))
    .join(" ");
  return (
    "lifecycle=" + controllerHost().lifecycle +
    " sceneVisible=" + view?.sceneVisible +
    " error=" + JSON.stringify(view?.errorPanel ?? null) +
    " notice=" + JSON.stringify(view?.notice ?? null) +
    " " + panels
  );
}

/** Like waitFor, but prints the experience state when the condition never holds. */
export async function waitForExperience(host: ViroSpecsExperienceHost, label: string, ready: () => boolean, timeoutMs: number = 3000): Promise<boolean> {
  const ok = await waitFor(ready, timeoutMs);
  if (!ok) print("VIRO_WS4 wait failed (" + label + "): " + describeExperience(host));
  return ok;
}

/** Sets ExperienceHost inputs read at start (they are fixed once it starts). */
export function configureExperience(inputs: { placementScene?: boolean; gazeOnly?: boolean }): void {
  const object = findSceneObjectByName(EXPERIENCE_HOST);
  expect(object).toBeTruthy();
  const host = (object as SceneObject).getComponent(ViroSpecsExperienceHost.getTypeName()) as ViroSpecsExperienceHost | null;
  expect(host).toBeTruthy();
  if (inputs.placementScene !== undefined) (host as ViroSpecsExperienceHost).placementScene = inputs.placementScene;
  if (inputs.gazeOnly !== undefined) (host as ViroSpecsExperienceHost).gazeOnly = inputs.gazeOnly;
}

/** Text of a panel row ("title", "body", "detail", or the action "label"). */
export function panelText(key: "loading" | "notice" | "error" | "permission", row: "title" | "body" | "detail" | "label"): string {
  const root = panel(key);
  expect(root).toBeTruthy();
  const find = (object: SceneObject): Text | null => {
    for (let i = 0; i < object.getChildrenCount(); i++) {
      const child = object.getChild(i);
      if (child.name === row) return child.getComponent("Component.Text") as Text | null;
      const nested = find(child);
      if (nested) return nested;
    }
    return null;
  };
  return find(root as SceneObject)?.text ?? "";
}

/**
 * The Interactable SIK binds on a panel's action button. The panel's backing
 * carries a listener-free Interactable that stops rays, so the search starts
 * at the "action" child.
 */
export function panelAction(key: "loading" | "notice" | "error" | "permission"): Interactable {
  const root = panel(key);
  expect(root).toBeTruthy();
  const action = (root as SceneObject).children.find((child) => child.name === "action") ?? null;
  expect(action).toBeTruthy();
  const found = findInteractables(
    (object: SceneObject) => (object.getComponent(Interactable.getTypeName()) as Interactable | null) ?? undefined,
    action as SceneObject,
    true
  )[0];
  expect(found).toBeTruthy();
  return found as Interactable;
}

/** The Interactable of a committed scene node. */
export function nodeInteractable(id: string): Interactable {
  const found = findInteractableByName("viro-interactable:" + id);
  expect(found).toBeTruthy();
  return found as Interactable;
}

/** Text drawn on a premium node by the experience layer ("label", "title" or "errorMessage" child). */
export function decorationText(id: string, child: "label" | "title" | "errorMessage"): Text | null {
  const object = controllerHost().getNode(id);
  if (!object) return null;
  for (let i = 0; i < object.getChildrenCount(); i++) {
    const c = object.getChild(i);
    if (c.name === child) return c.getComponent("Component.Text") as Text | null;
  }
  return null;
}

/**
 * The backing RenderMeshVisual the experience layer added to a premium node:
 * its first child with a mesh. SIK binds a button's interaction on it, which
 * renames it "viro-interactable:<id>".
 */
export function decorationBacking(id: string): RenderMeshVisual | null {
  const object = controllerHost().getNode(id);
  if (!object) return null;
  for (let i = 0; i < object.getChildrenCount(); i++) {
    const visual = object.getChild(i).getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null;
    if (visual) return visual;
  }
  return null;
}

/** Collects host diagnostics while `body` runs. */
export async function diagnosticsDuring(body: () => Promise<void>): Promise<ViroSpecsHostDiagnostic[]> {
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
 * Prints a marker and, when the run sets `hold_ms`, keeps the state on screen
 * that long so a capture can be taken from outside the Lens.
 */
export async function hold(config: ScenarioConfig | undefined, label: string): Promise<void> {
  const ms = Number(config?.get("hold_ms") ?? "0");
  print("VIRO_WS4_HOLD " + label + " " + ms);
  if (ms > 0) await sleep(ms);
}

type LoadAsset = (kind: "image" | "model", source: string) => unknown;

/**
 * Makes every asset load on the Lens backend resolve after `delayMs`, the way
 * a slow network GLB would, then restores the real loader. Test seam on the
 * backend prototype; the controller already accepts a Promise from loadAsset.
 */
export async function withSlowAssets<T>(delayMs: number, body: () => Promise<T>): Promise<T> {
  const prototype = ViroSpecsLensSceneBackend.prototype as unknown as { loadAsset: LoadAsset };
  const original = prototype.loadAsset;
  prototype.loadAsset = function (this: unknown, kind: "image" | "model", source: string): unknown {
    return sleep(delayMs).then(() => original.call(this, kind, source));
  };
  try {
    return await body();
  } finally {
    prototype.loadAsset = original;
  }
}

type HitCallback = (result: WorldQueryHitTestResult | null) => void;

/**
 * Replaces the experience host's WorldQuery session with one that reports
 * `hit` (centimeters, world) on every test, or nothing when `hit` is null.
 * Preview has no SPECS depth, so placement scenarios inject the hit.
 */
export function injectWorldQuery(host: ViroSpecsExperienceHost, hit: { position: vec3; normal: vec3 } | null): void {
  const stub = {
    hitTest: (_start: vec3, _end: vec3, callback: HitCallback): void => {
      callback(hit ? ({ position: hit.position, normal: hit.normal } as unknown as WorldQueryHitTestResult) : null);
    },
    start: (): void => undefined,
    stop: (): void => undefined,
  };
  (host as unknown as { hitSession: unknown }).hitSession = stub;
}

/**
 * Like {@linkcode injectWorldQuery}, but the hit lands on the head ray the
 * host tests, `distanceCm` from its start, the only place a real hit test can
 * report one. A hit off the ray (40 cm below it, as the scenarios used to
 * inject) put the reticle below the Preview frame.
 */
export function injectWorldQueryOnRay(host: ViroSpecsExperienceHost, distanceCm: number, normal: vec3): void {
  const stub = {
    hitTest: (start: vec3, end: vec3, callback: HitCallback): void => {
      const position = start.add(end.sub(start).normalize().uniformScale(distanceCm));
      callback({ position, normal } as unknown as WorldQueryHitTestResult);
    },
    start: (): void => undefined,
    stop: (): void => undefined,
  };
  (host as unknown as { hitSession: unknown }).hitSession = stub;
}

/** The scene camera's world position and forward direction. */
export function cameraPose(): { position: vec3; forward: vec3 } {
  const camera = findSceneObjectByName("Camera Object");
  expect(camera).toBeTruthy();
  const t = (camera as SceneObject).getTransform();
  return { position: t.getWorldPosition(), forward: t.getWorldRotation().multiplyVec3(new vec3(0, 0, -1)) };
}

/** Moves a committed node's object to `meters` along the camera's view, so gaze dwell can reach it. */
export function placeInGaze(id: string, meters: number): void {
  const object = controllerHost().getNode(id);
  expect(object).toBeTruthy();
  const pose = cameraPose();
  (object as SceneObject).getTransform().setWorldPosition(pose.position.add(pose.forward.uniformScale(meters * 100)));
  (object as SceneObject).getTransform().setWorldRotation(quat.lookAt(pose.forward.uniformScale(-1), vec3.up()));
}

export { sleep, waitFor };

/**
 * Lines a wrapped state-panel row was laid out for: its layoutRect height over
 * one line (type.lineHeight 1.3 times the em of its size).
 */
export function rowLines(key: "loading" | "notice" | "error" | "permission", row: "title" | "body" | "detail"): number {
  const root = panel(key) as SceneObject;
  const object = root.children.find((child) => child.name === row) ?? null;
  expect(object).toBeTruthy();
  const text = (object as SceneObject).getComponent("Component.Text") as Text;
  const rect = text.layoutRect;
  const lineCm = 1.3 * text.size * VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE * 100;
  return Math.round((rect.top - rect.bottom) / lineCm);
}

/** Every physics hit on the segment from `start` to `end`, nearest first. */
export async function rayHits(start: vec3, end: vec3): Promise<RayCastHit[]> {
  const probe = Physics.createGlobalProbe();
  return new Promise<RayCastHit[]>((resolve) => probe.rayCastAll(start, end, (hits: RayCastHit[]) => resolve(hits)));
}
