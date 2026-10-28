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
 * viro_ws4_move_band: Interaction: moving the model away step by step stops at the 3.0 m band
 * edge and logs VS5023 once. Uses the gaze Move API (moveNode); the Lens
 * adapter does not clamp hand drags.
 */
@component
export class ViroWs4MoveBandScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("interaction").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      const model = controllerHost().getNode("ix-model");
      expect(model).toBeTruthy();
      const diagnostics = await diagnosticsDuring(async () => {
        for (let i = 0; i < 25; i++) {
          host.moveNode("ix-model", "away");
          await sleep(20);
        }
      });
      const d = (model as SceneObject).getTransform().getWorldPosition().sub(cameraPose().position).length / 100;
      const clamps = diagnostics.filter((x) => x.code === "VS5023");
      print("VIRO_WS4 move_band distance m=" + d + " VS5023=" + clamps.length);
      expect(d).toBeLessThan(3.0 + 0.001);
      expect(d).toBeGreaterThan(2.9);
      expect(clamps.length).toBe(1);
      await hold(config, "interaction_band");
      print("VIRO_WS4 move_band PASS");
    } finally {
      await stopExperience();
    }
  }
}
