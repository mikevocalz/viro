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
 * viro_ws4_hello_degraded: Hello, degraded: hand tracking reports permission-required. The host logs
 * VS5021 and VS5024, shows the one-line notice, switches to gaze, and a
 * 1000 ms gaze dwell on Next scene selects it with source "gaze".
 */
@component
export class ViroWs4HelloDegradedScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("hello").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      const events: string[] = [];
      const subscription = controllerHost().addOnInteractionListener((event) => {
        if (event.nodeId === "hello-next") events.push(event.phase + ":" + event.source);
      });
      try {
        const diagnostics = await diagnosticsDuring(async () => {
          host.setCapabilities({ "hand-tracking": "permission-required" });
          await settle(200);
        });
        const codes = diagnostics.map((d) => d.code);
        print("VIRO_WS4 hello_degraded codes=" + JSON.stringify(codes) + " notice=" + panelText("notice", "body"));
        expect(codes.includes("VS5021")).toBe(true);
        expect(codes.includes("VS5024")).toBe(true);
        expect(viewOf(host).inputMode).toBe("gaze");
        expect(panelOpen("notice")).toBe(true);
        expect(panelText("notice", "body")).toBe("Hand tracking is off. Look at a button and hold your gaze to select.");
        await hold(config, "hello_degraded");
        // Put Next scene where the wearer looks; the dwell runs from the head ray.
        placeInGaze("hello-next", 1.2);
        expect(await waitFor(() => events.some((e) => e === "select-end:gaze"), 3000)).toBe(true);
        print("VIRO_WS4 hello_degraded events=" + events.join(","));
      } finally {
        subscription.remove();
      }
      print("VIRO_WS4 hello_degraded PASS");
    } finally {
      await stopExperience();
    }
  }
}
