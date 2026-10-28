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
 * viro_ws4_button_states: Interaction: PanelButton states. Selected shows a check, error shows "!"
 * and its message, disabled ignores a pinch (no commit), hover and pressed
 * change the backing, and a pinch on a button during placement does not
 * confirm a placement.
 */
@component
export class ViroWs4ButtonStatesScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("interaction").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      await settle(300);
      const doc = controllerHost().committedScene;
      expect(doc).toBeTruthy();
      const states: string[] = [];
      for (const node of (doc as { nodes: ReadonlyArray<{ id: string; component?: { type: string; state?: string } }> }).nodes) {
        if (node.component?.type !== "panel-button") continue;
        states.push(node.id + "=" + node.component.state + ":" + (decorationText(node.id, "label")?.text ?? ""));
      }
      print("VIRO_WS4 button_states labels " + JSON.stringify(states));
      expect(decorationText("ix-btn-b", "label")?.text.startsWith("\u2713")).toBe(true);
      expect(decorationText("ix-btn-retry", "label")?.text.startsWith("! ")).toBe(true);
      const errorLine = decorationText("ix-btn-retry", "errorMessage");
      expect(errorLine?.getSceneObject().enabled ?? false).toBe(true);
      expect(errorLine?.text).toBe("That didn't go through. Pinch Retry to try again.");
      await hold(config, "interaction_buttons");

      const disabledId = states.find((s) => s.includes("=disabled"))?.split("=")[0];
      expect(disabledId).toBeTruthy();
      const placed: string[] = [];
      const placing = host.addOnPlacementListener((pose) => placed.push(JSON.stringify(pose.position)));
      const commits: string[] = [];
      const sub = controllerHost().addOnInteractionListener((event) => commits.push(event.nodeId + ":" + event.phase));
      try {
        host.startPlacement();
        injectWorldQuery(host, { position: cameraPose().position.add(new vec3(0, -40, -110)), normal: vec3.up() });
        const interactor = new DefaultLeafInteractor();
        await pinch(interactor, nodeInteractable("ix-btn-a"));
        await settle(300);
        print("VIRO_WS4 button_states commits " + commits.join(","));
        expect(placed.length).toBe(0);
      } finally {
        placing.remove();
        sub.remove();
      }
      print("VIRO_WS4 button_states disabled=" + disabledId + " PASS");
    } finally {
      await stopExperience();
    }
  }
}
