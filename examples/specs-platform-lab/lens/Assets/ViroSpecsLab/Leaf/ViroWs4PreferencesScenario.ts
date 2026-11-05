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
 * viro_ws4_preferences: High contrast and reduced motion at runtime: the tokens switch to the
 * high-contrast set (#42525f surface, white text), button hover no longer
 * scales, and the loading indicator is static.
 */
@component
export class ViroWs4PreferencesScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("hello").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      await settle(300);
      host.setPreferences(true, true);
      await settle(200);
      const view = viewOf(host);
      print("VIRO_WS4 preferences surface=" + view.tokens.color.surface + " text=" + view.tokens.color.text);
      expect(view.tokens.color.surface.toLowerCase()).toBe("#42525f");
      expect(view.tokens.color.text.toLowerCase()).toBe("#ffffff");
      const backing = decorationBacking("hello-next") as RenderMeshVisual;
      const rest = backing.getSceneObject().getTransform().getLocalScale().x;
      await new DefaultLeafInteractor().hover(nodeInteractable("hello-next"), 300);
      const hovered = backing.getSceneObject().getTransform().getLocalScale().x;
      print("VIRO_WS4 preferences hover width " + rest + " -> " + hovered);
      expect(Math.abs(hovered - rest)).toBeLessThan(0.001);
      await hold(config, "preferences_ready");
      // Loading lasts through a capture hold (see viro_ws4_hello_loading).
      const holdMs = Number(config?.get("hold_ms") ?? "0");
      await withSlowAssets(2000 + holdMs, async () => {
        controllerHost().clear();
        expect(presentGallery("hello").status).toBe("committed");
        expect(await waitForExperience(host, "loading", () => panelOpen("loading"), 1000)).toBe(true);
        const loading = viewOf(host).loading;
        print("VIRO_WS4 preferences loading=" + JSON.stringify(loading));
        expect(loading.visible === true ? loading.indicator : "none").toBe("arc-static");
        await hold(config, "preferences_loading");
        expect(await waitFor(() => controllerHost().lifecycle === "ready", 5000 + holdMs)).toBe(true);
      });
      print("VIRO_WS4 preferences PASS");
    } finally {
      await stopExperience();
    }
  }
}
