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
 * viro_ws4_hello_error: Hello, error: the model's GLB is not registered. The node shows a
 * placeholder, the host logs VS5003 for platform-lab-model, the error panel
 * reads "Model didn't load" with one action, Retry, and pinching Retry hands
 * the node ID to the retry listener.
 */
@component
export class ViroWs4HelloErrorScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      const retried: string[] = [];
      const subscription = host.addOnRetryListener((ids) => retried.push(...ids));
      const diagnostics = await diagnosticsDuring(async () => {
        const result = presentGallery("hello", (doc) => {
          nodeOf(doc, "platform-lab-model").source = "examples/visionos-sweep/assets/missing.glb";
        });
        expect(result.status).toBe("committed");
        expect(await waitFor(() => panelOpen("error"), 3000)).toBe(true);
      });
      const lines = diagnostics.map((d) => d.code + " " + (d.nodeId ?? ""));
      print("VIRO_WS4 hello_error diagnostics=" + JSON.stringify(lines));
      expect(lines.includes("VS5003 platform-lab-model")).toBe(true);
      expect(findSceneObjectByName("viro-placeholder:platform-lab-model")).toBeTruthy();
      expect(panelText("error", "title")).toBe("Model didn't load");
      expect(panelText("error", "detail").includes("VS5003 (platform-lab-model)")).toBe(true);
      expect(panelText("error", "label")).toBe("Retry");
      // The rest of the scene still works.
      expect(textOf("viro:platform-lab-title")).toBe("Hello");
      await hold(config, "hello_error");
      await pinch(new DefaultLeafInteractor(), panelAction("error"));
      await settle(300);
      subscription.remove();
      print("VIRO_WS4 hello_error retried=" + JSON.stringify(retried));
      expect(retried.includes("platform-lab-model")).toBe(true);
      print("VIRO_WS4 hello_error PASS");
    } finally {
      await stopExperience();
    }
  }
}
