import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ViroSpecsPresentation, type ViroSpecsPresentationSnapshot } from "../../ViroSpecs/lens/ViroSpecsPresentation";
import { hold, withSlowAssets } from "./ViroLabExperienceSupport";
import { contentChildren, controllerHost, pinch, restoreGeneratedScene, settle, waitFor, waitForGeneratedScene } from "./ViroLabLeafSupport";

function page(tag: string, extra: ViroSpecsPresentationSnapshot["scene"]["nodes"] = []): ViroSpecsPresentationSnapshot {
  return {
    scene: {
      version: 1,
      nodes: [
        { id: `${tag}-root`, kind: "group", position: [0, 0, -1.5] },
        { id: `${tag}-card`, kind: "panel", parentId: `${tag}-root` },
        { id: `${tag}-label`, kind: "text", parentId: `${tag}-root`, position: [0, 0, 0.01], text: `page ${tag}`, textStyle: { size: 48, color: [1, 1, 1, 1] } },
        ...extra,
      ],
    },
    targets: [{ targetId: `${tag}-card`, action: `open:${tag}` }],
  };
}

/**
 * viro_lab_presentation: ViroSpecsPresentation (the core of
 * ViroSpecsPresentationHost) on the lab's ViroSpecsSceneControllerHost.
 * An invalid page throws and leaves the previous page on screen with its
 * target bound; a page with an unregistered image commits degraded, and the
 * previous page is gone only once the new one is up (one scene root
 * throughout); a pinch on the new page's target delivers its action string
 * on a later frame; with asset loads slowed, the next page commits in the
 * loading state with its panel and text enabled while the image loads, still
 * one scene root, and turns degraded when the load gives up. `hold_ms` keeps
 * the loading page up for a capture.
 */
@component
export class ViroLabPresentationScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();
    const presentation = new ViroSpecsPresentation(host);
    const actions: string[] = [];
    presentation.subscribeAction((action) => actions.push(action));
    try {
      presentation.present(page("pa"));
      await settle(200);
      expect(host.getNode("pa-card")).toBeTruthy();
      expect(findSceneObjectByName("viro-interactable:pa-card")).toBeTruthy();

      const invalid = page("pb");
      invalid.targets = [{ targetId: "nowhere", action: "open:pb" }];
      let threw = "";
      try {
        presentation.present(invalid);
      } catch (error) {
        threw = error instanceof Error ? error.message : String(error);
      }
      expect(threw.indexOf("Invalid or duplicate Specs action target") >= 0).toBe(true);
      await settle(100);
      expect(host.getNode("pa-card")).toBeTruthy();
      expect(findSceneObjectByName("viro-interactable:pa-card")).toBeTruthy();
      expect(contentChildren("viro-scene:").length).toBe(1);

      presentation.present(page("pb", [{ id: "pb-image", kind: "image", parentId: "pb-root", position: [0.2, 0, 0.01], source: "images/not-registered.png" }]));
      // Synchronous commit: page b is the committed page and page a is retired.
      expect(host.getNode("pb-card")).toBeTruthy();
      expect(host.getNode("pa-card")).toBeNull();
      expect(host.lifecycle).toBe("degraded");
      await settle(200);
      expect(contentChildren("viro-scene:").length).toBe(1);
      expect(findSceneObjectByName("viro-interactable:pa-card")).toBeNull();

      const card = findInteractableByName("viro-interactable:pb-card");
      expect(card).toBeTruthy();
      await pinch(new DefaultLeafInteractor(), card);
      expect(await waitFor(() => actions.length > 0, 2000)).toBe(true);
      expect(actions.join(",")).toBe("open:pb");

      const holdMs = Number(config?.get("hold_ms") ?? "0");
      await withSlowAssets(1500 + holdMs, async () => {
        presentation.present(page("pc", [{ id: "pc-image", kind: "image", parentId: "pc-root", position: [0.2, 0, 0.01], source: "images/not-registered.png" }]));
        expect(host.lifecycle).toBe("loading");
        expect(host.getNode("pc-label")).toBeTruthy();
        expect(host.getNode("pb-card")).toBeNull();
        await settle(200);
        expect(contentChildren("viro-scene:").length).toBe(1);
        expect((host.getNode("pc-label") as SceneObject).isEnabledInHierarchy).toBe(true);
        expect(findSceneObjectByName("viro-interactable:pc-card")).toBeTruthy();
        await hold(config, "presentation_loading");
        expect(await waitFor(() => host.lifecycle === "degraded", 4000 + holdMs)).toBe(true);
      });
      print("VIRO_LAB_LEAF presentation PASS invalid=\"" + threw + "\" slow=" + host.lifecycle + " actions=" + actions.join(","));
    } finally {
      presentation.dispose();
      await restoreGeneratedScene();
    }
  }
}
