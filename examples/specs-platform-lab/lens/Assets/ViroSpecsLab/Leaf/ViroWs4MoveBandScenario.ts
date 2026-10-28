import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { controllerHost, dragFrames, pinch, settle, textOf } from "./ViroLabLeafSupport";
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
 * viro_ws4_move_band: Interaction: moving the model away step by step with
 * the gaze Move API (moveNode) stops at the 3.0 m band edge and logs VS5023
 * once; a hand drag far to the side stops at the same edge and logs VS5023
 * once.
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

      // Hand drag: 20 cm sideways on each of 20 drag updates would carry the
      // model about 3.8 m from the wearer; the experience host holds it at 3.0 m.
      expect(presentGallery("interaction").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      await settle(200);
      const dragged = controllerHost().getNode("ix-model") as SceneObject;
      let frames = 0;
      const dragDiagnostics = await diagnosticsDuring(async () => {
        frames = await dragFrames(new DefaultLeafInteractor(), nodeInteractable("ix-model"), new vec3(20, 0, 0), 20);
        await settle(200);
      });
      const dragD = dragged.getTransform().getWorldPosition().sub(cameraPose().position).length / 100;
      const dragClamps = dragDiagnostics.filter((x) => x.code === "VS5023");
      print("VIRO_WS4 move_band hand drag frames=" + frames + " distance m=" + dragD + " VS5023=" + dragClamps.length);
      expect(dragD).toBeLessThan(3.0 + 0.001);
      expect(dragD).toBeGreaterThan(2.9);
      expect(dragClamps.length).toBe(1);
      await hold(config, "interaction_band");
      print("VIRO_WS4 move_band PASS");
    } finally {
      await stopExperience();
    }
  }
}
