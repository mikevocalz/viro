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
 * viro_ws4_navigation_image_error: Navigation, error: every card image is missing. One error panel opens
 * (not one per image), its detail lists each VS5003 line once, and the
 * cards still render with placeholders.
 */
@component
export class ViroWs4NavigationImageErrorScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      const diagnostics = await diagnosticsDuring(async () => {
        const result = presentGallery("navigation", (doc) => {
          for (const node of doc.nodes) if (node.kind === "image") node.source = "examples/visionos-sweep/assets/missing.png";
        });
        expect(result.status).toBe("committed");
        expect(await waitFor(() => panelOpen("error"), 3000)).toBe(true);
        await settle(300);
      });
      const vs5003 = diagnostics.filter((d) => d.code === "VS5003").map((d) => d.nodeId ?? "");
      const lines = panelText("error", "detail").split("\n").filter((l) => l !== "");
      print("VIRO_WS4 navigation_image_error VS5003=" + vs5003.length + " lines=" + JSON.stringify(lines) + " title=" + panelText("error", "title"));
      expect(lines.length).toBe(new Set(lines).size);
      expect(lines.length).toBe(new Set(vs5003).size);
      expect(findSceneObjectByName("ViroSpecsExperience-error")).toBeTruthy();
      expect(findSceneObjectByName("viro-placeholder:nav-card-1-image")).toBeTruthy();
      await hold(config, "navigation_image_error");
      print("VIRO_WS4 navigation_image_error PASS");
    } finally {
      await stopExperience();
    }
  }
}
