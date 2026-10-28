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
import { galleryScene } from "../Gallery/ViroLabGallery";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

function presentDoc(edit: (doc: ReturnType<typeof galleryScene>) => void): ReturnType<typeof galleryScene> {
  const doc = galleryScene("navigation");
  edit(doc);
  return doc;
}

/**
 * viro_ws4_navigation_scroll: Navigation: card, details, toggle, back, with the scroll position kept.
 * nav-list is a SpatialScrollView compiled to a scroll group: a SIK drag
 * scrolls it, scrollByRows reaches the last row so cards 5-8 sit inside the
 * window, a pinch on card 6 opens the detail view (the app's onOpenCard,
 * applied as a patch), the setting toggles, Back returns, and the list is at
 * the same position.
 */
@component
export class ViroWs4NavigationScrollScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("navigation").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready" || controllerHost().lifecycle === "degraded")).toBe(true);
      await settle(300);
      const scrollObject = findSceneObjectByName("viro-scroll:nav-list");
      expect(scrollObject).toBeTruthy();
      const windowCenter = (scrollObject as SceneObject).getTransform().getWorldPosition().y;
      const inWindow = (): string[] => {
        const out: string[] = [];
        for (let n = 1; n <= 8; n++) {
          const card = controllerHost().getNode("nav-card-" + n);
          if (!card) continue;
          const y = card.getTransform().getWorldPosition().y;
          // Window is 30 cm tall; a card is 11 cm.
          if (y + 5.5 <= windowCenter + 15 + 0.5 && y - 5.5 >= windowCenter - 15 - 0.5) out.push("nav-card-" + n);
        }
        return out;
      };
      print("VIRO_WS4 navigation top " + JSON.stringify(inWindow()));
      expect(inWindow()).toEqual(["nav-card-1", "nav-card-2", "nav-card-3", "nav-card-4"]);
      await hold(config, "navigation_top");

      // A hand drag on the list moves it (UI Kit ScrollWindow). Drags fling a
      // different distance on each run, so the position is then set in whole
      // rows with scrollByRows, which clamps at the end of the list.
      const before = controllerHost().getNodeState("nav-list")?.scrollNormalized?.[1] ?? 1;
      const interactor = new DefaultLeafInteractor();
      const listInteractable = (scrollObject as SceneObject).getComponent(Interactable.getTypeName()) as Interactable | null;
      expect(listInteractable).toBeTruthy();
      await interactor.drag(listInteractable as Interactable, new vec3(0, 1, 0), 500);
      await sleep(400);
      const dragged = controllerHost().getNodeState("nav-list")?.scrollNormalized?.[1] ?? 1;
      print("VIRO_WS4 navigation drag " + before + " -> " + dragged);
      expect(Math.abs(dragged - before)).toBeGreaterThan(0.01);
      expect(controllerHost().scrollByRows("nav-list", 8)).toBe(true);
      await settle(300);
      const bottom = controllerHost().getNodeState("nav-list")?.scrollNormalized?.[1] ?? 1;
      print("VIRO_WS4 navigation scroll " + before + " -> " + bottom + " visible " + JSON.stringify(inWindow()));
      expect(inWindow()).toEqual(["nav-card-5", "nav-card-6", "nav-card-7", "nav-card-8"]);
      await hold(config, "navigation_bottom");

      const opened: string[] = [];
      const sub = controllerHost().addOnInteractionListener((event) => {
        if (event.phase === "select-end") opened.push(event.nodeId);
      });
      try {
        await pinch(interactor, nodeInteractable("nav-card-6"));
        expect(await waitFor(() => opened.includes("nav-card-6"))).toBe(true);
        // The app's onOpenCard: hide the list view, show the detail with the card's title.
        const scene = presentDoc((doc) => {
          nodeOf(doc, "nav-list-view").visible = false;
          nodeOf(doc, "nav-detail").visible = true;
          nodeOf(doc, "nav-detail-title").text = "Card 6";
        });
        expect(controllerHost().update(scene).status).toBe("patched");
        await settle(300);
        expect(textOf("viro:nav-detail-title")).toBe("Card 6");
        await hold(config, "navigation_detail");
        await pinch(interactor, nodeInteractable("nav-setting-labels"));
        expect(await waitFor(() => opened.includes("nav-setting-labels"))).toBe(true);
        const toggled = presentDoc((doc) => {
          nodeOf(doc, "nav-list-view").visible = false;
          nodeOf(doc, "nav-detail").visible = true;
          nodeOf(doc, "nav-detail-title").text = "Card 6";
          (nodeOf(doc, "nav-setting-labels").component as Record<string, unknown>).state = "idle";
        });
        expect(controllerHost().update(toggled).status).toBe("patched");
        await settle(300);
        await pinch(interactor, nodeInteractable("nav-back"));
        expect(await waitFor(() => opened.includes("nav-back"))).toBe(true);
        const back = presentDoc((doc) => {
          (nodeOf(doc, "nav-setting-labels").component as Record<string, unknown>).state = "idle";
        });
        expect(controllerHost().update(back).status).toBe("patched");
        await settle(300);
      } finally {
        sub.remove();
      }
      const kept = controllerHost().getNodeState("nav-list")?.scrollNormalized?.[1] ?? 1;
      print("VIRO_WS4 navigation back scroll=" + kept + " visible " + JSON.stringify(inWindow()));
      expect(Math.abs(kept - bottom)).toBeLessThan(0.01);
      expect(inWindow()).toEqual(["nav-card-5", "nav-card-6", "nav-card-7", "nav-card-8"]);
      await hold(config, "navigation_back");
      print("VIRO_WS4 navigation_scroll PASS");
    } finally {
      await stopExperience();
    }
  }
}
