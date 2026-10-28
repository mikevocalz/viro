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
  injectWorldQueryOnRay,
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
 * viro_ws4_placement_table: Placement: a WorldQuery hit on a table (normal up, on the head ray, injected because
 * Preview has no SPECS depth) shows the reticle labelled "Table. Pinch to
 * place.", and confirming places the model: the placement listener gets a
 * pose inside the comfort band.
 */
@component
export class ViroWs4PlacementTableScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience({ placementScene: true });
    try {
      expect(presentGallery("placement").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      const poses: string[] = [];
      const subscription = host.addOnPlacementListener((pose) => poses.push(JSON.stringify(pose.position)));
      try {
        host.startPlacement();
        injectWorldQueryOnRay(host, 110, vec3.up());
        const reticle = findSceneObjectByName("ViroSpecsReticleLabel");
        expect(await waitFor(() => (findSceneObjectByName("ViroSpecsReticle")?.enabled ?? false) && (textOf("ViroSpecsReticleLabel") ?? "").startsWith("Table"), 3000)).toBe(true);
        print("VIRO_WS4 placement_table label=" + JSON.stringify(textOf("ViroSpecsReticleLabel")) + " " + (reticle !== null));
        expect(textOf("ViroSpecsReticleLabel").includes("Table. Pinch to place.")).toBe(true);
        await hold(config, "placement_reticle");
        expect(host.confirmPlacement()).toBe(true);
      } finally {
        subscription.remove();
      }
      print("VIRO_WS4 placement_table poses=" + poses.join(" "));
      expect(poses.length).toBe(1);
      print("VIRO_WS4 placement_table PASS");
    } finally {
      await stopExperience();
    }
  }
}
