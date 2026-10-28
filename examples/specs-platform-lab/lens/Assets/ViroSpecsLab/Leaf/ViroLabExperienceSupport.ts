import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { findInteractableByName, findInteractables } from "Leaf.lspkg/Interactors/InteractableUtils";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { ViroSpecsExperienceHost } from "../../ViroSpecs/lens/ViroSpecsExperienceLensView";
import type { ViroSpecsExperienceController, ViroSpecsExperienceView } from "../../ViroSpecs/lens/ViroSpecsExperience";
import { ViroSpecsLensSceneBackend } from "../../ViroSpecs/lens/ViroSpecsLensSceneBackend";
import type { ViroSpecsHostDiagnostic } from "../../ViroSpecs/lens/ViroSpecsHostDiagnostics";
import type { ViroSpecsApplyResult } from "../../ViroSpecs/lens/ViroSpecsSceneController";
import { galleryScene, type ViroLabGalleryScene } from "../Gallery/ViroLabGallery";
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
export async function startExperience(): Promise<ViroSpecsExperienceHost> {
  await waitForGeneratedScene();
  const object = findSceneObjectByName(EXPERIENCE_HOST);
  expect(object).toBeTruthy();
  object.enabled = true;
  const lookup = (): ViroSpecsExperienceHost | null =>
    object.getComponent(ViroSpecsExperienceHost.getTypeName()) as ViroSpecsExperienceHost | null;
  expect(await waitFor(() => lookup()?.controller !== null && lookup()?.controller !== undefined)).toBe(true);
  return lookup() as ViroSpecsExperienceHost;
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
  return object !== null && object.enabled;
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

/** The Interactable SIK binds on a panel's action button. */
export function panelAction(key: "loading" | "notice" | "error" | "permission"): Interactable {
  const root = panel(key);
  expect(root).toBeTruthy();
  const found = findInteractables(
    (object: SceneObject) => (object.getComponent(Interactable.getTypeName()) as Interactable | null) ?? undefined,
    root as SceneObject,
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

/** The backing RenderMeshVisual the experience layer added to a premium node. */
export function decorationBacking(id: string): RenderMeshVisual | null {
  const object = controllerHost().getNode(id);
  if (!object) return null;
  for (let i = 0; i < object.getChildrenCount(); i++) {
    const c = object.getChild(i);
    if (c.name === "backing") return c.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null;
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
