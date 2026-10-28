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
 * viro_ws4_placement_cancel: Placement, look away: with no valid hit for 1.5 s the attempt cancels
 * (reticle hidden, nothing placed), and the cancel hint does not come back
 * while the wearer keeps looking away.
 */
@component
export class ViroWs4PlacementCancelScenario extends Scenario {
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
        expect(await waitFor(() => findSceneObjectByName("ViroSpecsReticle")?.enabled ?? false, 3000)).toBe(true);
        // Look away: no hit at all.
        injectWorldQuery(host, null);
        await sleep(2200);
        const labels: string[] = [];
        for (let i = 0; i < 5; i++) {
          labels.push((findSceneObjectByName("ViroSpecsReticle")?.enabled ? "on:" : "off:") + (textOf("ViroSpecsReticleLabel") ?? ""));
          await sleep(200);
        }
        print("VIRO_WS4 placement_cancel after look-away " + JSON.stringify(labels));
        // While the wearer keeps looking away the reticle, and its cancel hint, stay hidden.
        expect(labels.every((l) => l.startsWith("off:"))).toBe(true);
        expect(host.confirmPlacement()).toBe(false);
        await hold(config, "placement_cancelled");
      } finally {
        subscription.remove();
      }
      expect(poses.length).toBe(0);
      print("VIRO_WS4 placement_cancel PASS");
    } finally {
      await stopExperience();
    }
  }
}
