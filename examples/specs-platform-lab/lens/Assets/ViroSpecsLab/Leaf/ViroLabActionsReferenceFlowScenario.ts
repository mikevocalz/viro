import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { hold } from "./ViroLabExperienceSupport";
import {
  contentChildren,
  controllerHost,
  describeTree,
  pinch,
  recordDiagnostics,
  settle,
  startActionsLab,
  stopActionsLab,
  textOf,
  visibleCard,
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
 * Lens through ViroSpecsActionsLab. The list is left scrolled, SIK input
 * pinches a visible card (exhibit.open), the details route shows it, a pinch on the units
 * toggle changes the setting (settings.set-units) and the view updates in
 * place, and a pinch on Back (nav.back) returns to the list with the scroll
 * position the wearer left.
 */
@component
export class ViroLabActionsReferenceFlowScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const lab = await startActionsLab();
    const host = controllerHost();
    const interactor = new DefaultLeafInteractor();
    const actions: string[] = [];
    let selectedCard = "";
    const subscription = host.addOnActionListener((event) =>
      actions.push(event.actionId + " " + JSON.stringify(event.payload) + " " + event.nodeId + " " + event.source)
    );
    try {
      const diagnostics = await recordDiagnostics(async () => {
        expect(lab.state?.route).toBe("list");
        // The list as it first opens, scrolled to the top, for a capture.
        await settle();
        await hold(config, "reference_list_top");

        // The wearer leaves the list scrolled part way. The position is set on
        // the ScrollWindow directly: a LEAF drag reaches it (see
        // viro_lab_scroll_window) but flings and overscrolls by a different
        // amount on each run (0.29, -0.35, -0.17 and 1 observed), and this
        // scenario checks that a known position survives the round trip.
        const scroll = listScroll();
        const start = scroll.scrollPositionNormalized.y;
        scroll.scrollPositionNormalized = new vec2(0, 0.4);
        await sleep(300);
        const left = scroll.scrollPositionNormalized.y;
        print("VIRO_LAB_LEAF actions_reference_flow scroll " + start + " -> " + left);
        expect(Math.abs(left - 0.4)).toBeLessThan(0.01);

        // Pinch the card nearest the middle of the scrolled window.
        const picked = visibleCard(lab);
        const card = findInteractableByName("viro-interactable:card-" + picked.id);
        expect(card).toBeTruthy();
        const cardPinch = await pinch(interactor, card);
        expect(await waitFor(() => lab.state?.route === "details")).toBe(true);
        await settle();
        expect(lab.state?.selectedId).toBe(picked.id);
        expect(textOf("viro:details-title")).toBe(picked.title);
        expect(textOf("viro:details-distance")).toBe(picked.distanceMeters + " m away");
        expect(findSceneObjectByName("viro-scroll:exhibit-list")).toBeFalsy();

        // Change a setting: a patch on the details scene, not a navigation.
        const detailsRoots = contentChildren("viro-scene:").map((o) => o.name).join(",");
        const toggle = findInteractableByName("viro-interactable:units-toggle");
        expect(toggle).toBeTruthy();
        const togglePinch = await pinch(interactor, toggle);
        expect(await waitFor(() => lab.state?.units === "imperial")).toBe(true);
        await settle();
        expect(textOf("viro:details-distance")).toBe(Math.round(picked.distanceMeters * 3.28084) + " ft away");
        print("VIRO_LAB_LEAF actions_reference_flow toggle tree:\n" + describeTree(host.getNode("units-toggle")));
        expect(textOf("viro:units-toggle-label")).toBe("Show meters");
        expect(contentChildren("viro-scene:").map((o) => o.name).join(",")).toBe(detailsRoots);

        // Back to the list at the scroll position the wearer left.
        const back = findInteractableByName("viro-interactable:back-button");
        expect(back).toBeTruthy();
        const backPinch = await pinch(interactor, back);
        expect(await waitFor(() => lab.state?.route === "list" && findSceneObjectByName("viro-scroll:exhibit-list") !== null)).toBe(true);
        await sleep(1000);
        const restored = listScroll().scrollPositionNormalized.y;
        print("VIRO_LAB_LEAF actions_reference_flow scroll restored " + restored + " (left " + left + ")");
        expect(Math.abs(restored - left)).toBeLessThan(0.01);
        expect(lab.state?.selectedId).toBe(picked.id);
        expect(lab.state?.units).toBe("imperial");
        // Navigation retires the pinched card and the Back button; the
        // in-place units patch keeps its toggle.
        print("VIRO_LAB_LEAF actions_reference_flow retired card=" + cardPinch.retired + " toggle=" + togglePinch.retired + " back=" + backPinch.retired);
        expect(togglePinch.retired).toBe(false);
        selectedCard = picked.id;
      });

      expect(actions.length).toBe(3);
      expect(actions[0].startsWith('exhibit.open {"exhibitId":"' + selectedCard + '"} card-' + selectedCard)).toBe(true);
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
