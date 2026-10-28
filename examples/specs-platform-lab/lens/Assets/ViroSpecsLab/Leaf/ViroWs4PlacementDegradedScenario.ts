import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
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
  withSlowAssets,
} from "./ViroLabExperienceSupport";

/**
 * viro_ws4_placement_degraded: Placement, degraded: world-query is unsupported. The notice reads
 * "Placement isn't available on this device...", placement UI is hidden (no
 * reticle even after startPlacement), and the model stays in front of the
 * wearer inside the comfort band.
 */
@component
export class ViroWs4PlacementDegradedScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("placement").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      host.setCapabilities({ "world-query": "unsupported" });
      await settle(200);
      const view = viewOf(host);
      expect(view.hidden.placement).toBe(true);
      expect(view.placeInFront).toBe(true);
      expect(panelOpen("notice")).toBe(true);
      expect(panelText("notice", "body")).toBe("Placement isn't available on this device. Content stays in front of you.");
      host.startPlacement();
      await sleep(500);
      expect(findSceneObjectByName("ViroSpecsReticle")?.enabled ?? false).toBe(false);
      const model = controllerHost().getNode("placement-model");
      expect(model).toBeTruthy();
      const d = (model as SceneObject).getTransform().getWorldPosition().sub(cameraPose().position).length / 100;
      print("VIRO_WS4 placement_degraded model distance m=" + d);
      expect(d).toBeGreaterThan(0.6);
      expect(d).toBeLessThan(3.0);
      await hold(config, "placement_degraded");
      print("VIRO_WS4 placement_degraded PASS");
    } finally {
      await stopExperience();
    }
  }
}
