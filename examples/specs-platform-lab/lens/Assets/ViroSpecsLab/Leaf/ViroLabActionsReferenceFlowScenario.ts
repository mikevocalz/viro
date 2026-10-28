import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import {
  contentChildren,
  controllerHost,
  recordDiagnostics,
  settle,
  startActionsLab,
  stopActionsLab,
  textOf,
  waitFor,
} from "./ViroLabLeafSupport";

function listScroll(): ScrollWindow {
  const object = findSceneObjectByName("viro-scroll:exhibit-list");
  expect(object).toBeTruthy();
  const scroll = object.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null;
  expect(scroll).toBeTruthy();
  return scroll as ScrollWindow;
}

/**
 * viro_lab_actions_reference_flow: the WS3b reference flow, standalone in the
 * Lens through ViroSpecsActionsLab. SIK input scrolls the list and pinches a
 * card (exhibit.open), the details route shows it, a pinch on the units
 * toggle changes the setting (settings.set-units) and the view updates in
 * place, and a pinch on Back (nav.back) returns to the list with the scroll
 * position the wearer left.
 */
@component
export class ViroLabActionsReferenceFlowScenario extends Scenario {
  async run(): Promise<void> {
    const lab = await startActionsLab();
    const host = controllerHost();
    const interactor = new DefaultLeafInteractor();
    const actions: string[] = [];
    const subscription = host.addOnActionListener((event) =>
      actions.push(event.actionId + " " + JSON.stringify(event.payload) + " " + event.nodeId + " " + event.source)
    );
    try {
      const diagnostics = await recordDiagnostics(async () => {
        expect(lab.state?.route).toBe("list");

        // The wearer scrolls the list with a SIK drag.
        const scroll = listScroll();
        const scrollInteractable = scroll.getSceneObject().getComponent(Interactable.getTypeName()) as Interactable | null;
        expect(scrollInteractable).toBeTruthy();
        const start = scroll.scrollPositionNormalized.y;
        await interactor.drag(scrollInteractable as Interactable, new vec3(0, 1, 0), 500);
        await sleep(300);
        const left = scroll.scrollPositionNormalized.y;
        print("VIRO_LAB_LEAF actions_reference_flow scroll " + start + " -> " + left);
        expect(Math.abs(left - start)).toBeGreaterThan(0.01);

        // Select a card.
        const card = findInteractableByName("viro-interactable:card-planetarium");
        expect(card).toBeTruthy();
        await interactor.hover(card, 100);
        await interactor.trigger(card);
        expect(await waitFor(() => lab.state?.route === "details")).toBe(true);
        await settle();
        expect(lab.state?.selectedId).toBe("planetarium");
        expect(textOf("viro:details-title")).toBe("Planetarium");
        expect(textOf("viro:details-distance")).toBe("120 m away");
        expect(findSceneObjectByName("viro-scroll:exhibit-list")).toBeFalsy();

        // Change a setting: a patch on the details scene, not a navigation.
        const detailsRoots = contentChildren("viro-scene:").map((o) => o.name).join(",");
        const toggle = findInteractableByName("viro-interactable:units-toggle");
        expect(toggle).toBeTruthy();
        await interactor.hover(toggle, 100);
        await interactor.trigger(toggle);
        expect(await waitFor(() => lab.state?.units === "imperial")).toBe(true);
        await settle();
        expect(textOf("viro:details-distance")).toBe("394 ft away");
        expect(textOf("viro:units-toggle-label")).toBe("Show meters");
        expect(contentChildren("viro-scene:").map((o) => o.name).join(",")).toBe(detailsRoots);

        // Back to the list at the scroll position the wearer left.
        const back = findInteractableByName("viro-interactable:back-button");
        expect(back).toBeTruthy();
        await interactor.hover(back, 100);
        await interactor.trigger(back);
        expect(await waitFor(() => lab.state?.route === "list" && findSceneObjectByName("viro-scroll:exhibit-list") !== null)).toBe(true);
        await settle(300);
        const restored = listScroll().scrollPositionNormalized.y;
        print("VIRO_LAB_LEAF actions_reference_flow scroll restored " + restored + " (left " + left + ")");
        expect(Math.abs(restored - left)).toBeLessThan(0.01);
        expect(lab.state?.selectedId).toBe("planetarium");
        expect(lab.state?.units).toBe("imperial");
      });

      expect(actions.length).toBe(3);
      expect(actions[0].startsWith('exhibit.open {"exhibitId":"planetarium"} card-planetarium')).toBe(true);
      expect(actions[1].startsWith('settings.set-units {"units":"imperial"} units-toggle')).toBe(true);
      expect(actions[2].startsWith("nav.back {} back-button")).toBe(true);
      const problems = diagnostics.filter((d) => d.severity !== "info").map((d) => d.code + " " + d.message);
      print("VIRO_LAB_LEAF actions_reference_flow actions=" + JSON.stringify(actions) + " problems=" + JSON.stringify(problems));
      expect(problems.length).toBe(0);
      print("VIRO_LAB_LEAF actions_reference_flow PASS");
    } finally {
      subscription.remove();
      await stopActionsLab();
    }
  }
}
