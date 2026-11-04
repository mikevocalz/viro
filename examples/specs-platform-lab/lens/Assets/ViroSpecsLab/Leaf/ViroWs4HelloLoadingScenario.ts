import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findInteractableByName, isEnabled } from "Leaf.lspkg/Interactors/InteractableUtils";
import { controllerHost, pinch, settle, textOf } from "./ViroLabLeafSupport";
import {
  cameraPose,
  controllerOf,
  decorationBacking,
  decorationText,
  diagnosticsDuring,
  hold,
  injectWorldQuery,
  nodeInteractable,
  nodeOf,
  panelAction,
  panelOpen,
  panelText,
  placeInGaze,
  presentGallery,
  sleep,
  startExperience,
  stopExperience,
  viewOf,
  waitFor,
  waitForExperience,
  withSlowAssets,
} from "./ViroLabExperienceSupport";

/**
 * viro_ws4_hello_loading: Hello, loading: with the GLB load slowed to 2.5 s, the loading panel
 * appears after motion.fast (120 ms) reading "Loading 0 of 1", the scene
 * shows no interactables while loading, the ModelViewer's own load ring stays
 * off while the panel reports the load, and the panel goes away when the
 * model arrives.
 */
@component
export class ViroWs4HelloLoadingScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    // A capture hold keeps the model loading for the whole hold, so the
    // loading panel is still up when the capture is taken.
    const holdMs = Number(config?.get("hold_ms") ?? "0");
    try {
      await withSlowAssets(2500 + holdMs, async () => {
        const result = presentGallery("hello");
        expect(result.status).toBe("committed");
        expect(await waitForExperience(host, "loading", () => panelOpen("loading"), 1000)).toBe(true);
        const view = viewOf(host);
        print("VIRO_WS4 hello_loading lifecycle=" + controllerHost().lifecycle + " body=" + panelText("loading", "body"));
        expect(controllerHost().lifecycle).toBe("loading");
        expect(view.sceneVisible).toBe(false);
        expect(panelText("loading", "title")).toBe("Loading scene");
        expect(panelText("loading", "body").startsWith("Loading 0 of 1")).toBe(true);
        // Content and its SIK targets stay hidden until the scene is ready (A-check L4).
        expect(isEnabled(findInteractableByName("viro-interactable:hello-next"))).toBe(false);
        // The loading panel reports the pending GLB, so the ModelViewer's own
        // load ring stays off: two rings at overlay order 101 overlapped the
        // panel title (viroSpecsShowModelRing).
        const ring = findSceneObjectByName("ViroSpecsModelRing:platform-lab-model");
        expect(ring).toBeTruthy();
        expect((ring as SceneObject).enabled).toBe(false);
        print("VIRO_WS4 hello_loading model ring hidden under the loading panel");
        await hold(config, "hello_loading");
        expect(await waitFor(() => controllerHost().lifecycle === "ready", 6000 + holdMs)).toBe(true);
      });
      await settle(300);
      expect(panelOpen("loading")).toBe(false);
      expect(findSceneObjectByName("ViroSpecsModelRing:platform-lab-model")?.enabled ?? false).toBe(false);
      expect(viewOf(host).sceneVisible).toBe(true);
      expect(isEnabled(findInteractableByName("viro-interactable:hello-next"))).toBe(true);
      // The model node holds the instantiated prefab once the slow load lands.
      expect(controllerHost().getNode("platform-lab-model")?.getChildrenCount() ?? 0).toBeGreaterThan(0);
      print("VIRO_WS4 hello_loading PASS");
    } finally {
      await stopExperience();
    }
  }
}
