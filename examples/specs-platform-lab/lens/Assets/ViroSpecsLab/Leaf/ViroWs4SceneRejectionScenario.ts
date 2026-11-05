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
  waitForExperience,
  withSlowAssets,
} from "./ViroLabExperienceSupport";

/**
 * viro_ws4_scene_rejection: Scene rejection: a bad update over a working scene shows "Scene couldn't
 * open" with Close and keeps the previous scene; a bad first scene shows the
 * no-fallback panel, which stays up after Close.
 */
@component
export class ViroWs4SceneRejectionScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("hello").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      const bad = { version: 2, nodes: [{ id: "x", kind: "text" }], polylines: [], lights: [], materials: [], interactions: [], animations: [] };
      expect(controllerHost().update(bad).status).toBe("rejected");
      expect(await waitForExperience(host, "error", () => panelOpen("error"), 2000)).toBe(true);
      expect(panelText("error", "title")).toBe("Scene couldn't open");
      expect(panelText("error", "body")).toBe("The last working scene is still here.");
      expect(panelText("error", "label")).toBe("Close");
      expect(textOf("viro:platform-lab-title")).toBe("Hello");
      await hold(config, "rejection_update");
      await pinch(new DefaultLeafInteractor(), panelAction("error"));
      expect(await waitFor(() => !panelOpen("error"), 2000)).toBe(true);

      controllerHost().clear();
      await settle(200);
      expect(controllerHost().present(bad).status).toBe("rejected");
      expect(await waitForExperience(host, "error", () => panelOpen("error"), 2000)).toBe(true);
      print("VIRO_WS4 scene_rejection first-scene body=" + panelText("error", "body"));
      expect(panelText("error", "body").startsWith("Close this lens and open it again.")).toBe(true);
      await hold(config, "rejection_first");
      await pinch(new DefaultLeafInteractor(), panelAction("error"));
      await settle(300);
      expect(panelOpen("error")).toBe(true);
      print("VIRO_WS4 scene_rejection PASS");
    } finally {
      await stopExperience();
    }
  }
}
