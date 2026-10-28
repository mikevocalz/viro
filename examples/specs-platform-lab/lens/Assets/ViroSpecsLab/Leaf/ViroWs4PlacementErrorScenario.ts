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
 * viro_ws4_placement_error: Placement, error: the model is missing. A placeholder stands in, the error
 * panel opens, and a placement on an injected table hit still confirms, so
 * the placeholder can be placed.
 */
@component
export class ViroWs4PlacementErrorScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      const result = presentGallery("placement", (doc) => {
        nodeOf(doc, "placement-model").source = "examples/visionos-sweep/assets/missing.glb";
      });
      expect(result.status).toBe("committed");
      expect(await waitFor(() => panelOpen("error"), 3000)).toBe(true);
      expect(findSceneObjectByName("viro-placeholder:placement-model")).toBeTruthy();
      expect(panelText("error", "title")).toBe("Model didn't load");
      const poses: string[] = [];
      const subscription = host.addOnPlacementListener((pose) => poses.push(JSON.stringify(pose.position)));
      try {
        host.startPlacement();
        injectWorldQuery(host, { position: cameraPose().position.add(new vec3(0, -40, -110)), normal: vec3.up() });
        expect(await waitFor(() => findSceneObjectByName("ViroSpecsReticle")?.enabled ?? false, 3000)).toBe(true);
        await hold(config, "placement_error");
        expect(host.confirmPlacement()).toBe(true);
      } finally {
        subscription.remove();
      }
      expect(poses.length).toBe(1);
      print("VIRO_WS4 placement_error PASS");
    } finally {
      await stopExperience();
    }
  }
}
