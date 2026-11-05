import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { controllerHost, pinch, recordDiagnostics, settle, startActionsLab, stopActionsLab, textOf, visibleCard, waitFor } from "./ViroLabLeafSupport";

/**
 * viro_lab_actions_navigation_drop: a pinch on a list card queues
 * exhibit.open for the next frame. App code navigates to a different card
 * before that frame, which retires the list scene; the queued action is
 * dropped with VS5018 (info) naming the card, and it never reaches the
 * reducer.
 */
@component
export class ViroLabActionsNavigationDropScenario extends Scenario {
  async run(): Promise<void> {
    const lab = await startActionsLab();
    const host = controllerHost();
    const reducedRoutes: string[] = [];
    let navigated = false;
    // Pinch a card the wearer can see; app code then opens a different one.
    const pinched = visibleCard(lab);
    const opened = (lab.state?.exhibits ?? []).find((e) => e.id !== pinched.id);
    expect(opened).toBeTruthy();
    const openedId = opened ? opened.id : "";
    const openedTitle = opened ? opened.title : "";
    try {
      const diagnostics = await recordDiagnostics(async () => {
        const interactions = host.addOnInteractionListener((event) => {
          if (navigated || event.nodeId !== "card-" + pinched.id || event.phase !== "select-end") return;
          navigated = true;
          // Same frame as the pinch: navigate before the queued action runs.
          reducedRoutes.push(String(lab.dispatch("exhibit.open", { exhibitId: openedId })));
        });
        try {
          const card = findInteractableByName("viro-interactable:card-" + pinched.id);
          expect(card).toBeTruthy();
          const interactor = new DefaultLeafInteractor();
          await pinch(interactor, card);
          await waitFor(() => navigated);
          await settle(400);
        } finally {
          interactions.remove();
        }
      });

      expect(navigated).toBe(true);
      expect(reducedRoutes.join(",")).toBe("true");
      expect(lab.state?.route).toBe("details");
      expect(lab.state?.selectedId).toBe(openedId);
      expect(textOf("viro:details-title")).toBe(openedTitle);
      const dropped = diagnostics.filter((d) => d.code === "VS5018");
      print("VIRO_LAB_LEAF actions_navigation_drop diagnostics=" + JSON.stringify(diagnostics.map((d) => d.code + ":" + (d.nodeId ?? "") + ":" + d.message)));
      expect(dropped.length).toBe(1);
      expect(dropped[0].nodeId).toBe("card-" + pinched.id);
      expect(dropped[0].severity).toBe("info");
      print("VIRO_LAB_LEAF actions_navigation_drop PASS");
    } finally {
      await stopActionsLab();
    }
  }
}
