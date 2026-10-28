import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { controllerHost, describeTree, pinch, settle, textOf } from "./ViroLabLeafSupport";
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
 * viro_ws4_hello_ready: Hello, ready: hovering Next scene draws its hover state (backing scaled
 * up, label "Next scene"), a pinch releasing on it commits once and the app
 * navigates to Placement, and a press released outside (cancel) commits
 * nothing.
 */
@component
export class ViroWs4HelloReadyScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("hello").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      await settle(300);
      expect(viewOf(host).sceneVisible).toBe(true);
      expect(decorationText("hello-next", "label")?.text).toBe("Next scene");
      print("VIRO_WS4 hello_ready tree:\n" + describeTree(controllerHost().getNode("hello-next")));
      const backing = decorationBacking("hello-next");
      expect(backing).toBeTruthy();
      const restWidth = (backing as RenderMeshVisual).getSceneObject().getTransform().getLocalScale().x;

      const commits: string[] = [];
      const subscription = controllerHost().addOnInteractionListener((event) => {
        if (event.nodeId === "hello-next") commits.push(event.phase + ":" + event.source);
      });
      try {
        // Press then cancel: the button never commits.
        controllerHost().dispatchInteraction({ nodeId: "hello-next", phase: "select-start", source: "hand-right" });
        controllerHost().dispatchInteraction({ nodeId: "hello-next", phase: "cancel", source: "hand-right" });
        await settle(100);
        expect(commits.filter((c) => c.startsWith("select-end")).length).toBe(0);

        const interactor = new DefaultLeafInteractor();
        const next = nodeInteractable("hello-next");
        await interactor.hover(next, 300);
        const hoverWidth = (backing as RenderMeshVisual).getSceneObject().getTransform().getLocalScale().x;
        print("VIRO_WS4 hello_ready hover width " + restWidth + " -> " + hoverWidth);
        expect(hoverWidth).toBeGreaterThan(restWidth);
        await hold(config, "hello_ready_hover");
        await pinch(interactor, next);
        await settle(200);
        print("VIRO_WS4 hello_ready phases=" + commits.join(","));
        expect(commits.filter((c) => c.startsWith("select-end")).length).toBe(1);
      } finally {
        subscription.remove();
      }
      // The app's onPress: go to the next gallery scene.
      expect(presentGallery("placement").status).toBe("committed");
      expect(await waitFor(() => findSceneObjectByName("viro:placement-title") !== null)).toBe(true);
      expect(textOf("viro:placement-title")).toBe("Placement");
      print("VIRO_WS4 hello_ready PASS");
    } finally {
      await stopExperience();
    }
  }
}
