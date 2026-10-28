import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { nextFrame, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { controllerHost, document, phases, recordInteractions, restoreGeneratedScene, settle, waitForGeneratedScene } from "./ViroLabLeafSupport";

const ALL_PHASES = ["hover-enter", "hover-move", "hover-exit", "select-start", "select-end", "drag", "cancel"];
const NODE = "phases-model";

/** Exposes LEAF's own hover and aim controls so a trigger can end off target. */
class PhaseInteractor extends DefaultLeafInteractor {
  async enter(target: Interactable): Promise<void> {
    await this.enterHover(target);
  }
  /** Points the interactor at nothing while the trigger is held. */
  aimAway(): void {
    this.overrideInteractable = undefined;
  }
}

async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) await nextFrame();
}

/**
 * viro_lab_interaction_phases: every portable phase the scene controller
 * forwards comes from real SIK input on a model that declares hover, select
 * and drag: hover-enter/hover-move/hover-exit from a hover, select-start/
 * select-end from a trigger, drag from manipulation, and cancel from a trigger
 * released after the interactor has left the target (SIK onTriggerEndOutside).
 */
@component
export class ViroLabInteractionPhasesScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();
    try {
      host.present(
        document({
          nodes: [
            { id: "phases-root", kind: "group", position: [0, 0, -1.5] },
            {
              id: NODE,
              kind: "model",
              parentId: "phases-root",
              position: [0, -0.05, 0],
              scale: [0.18, 0.18, 0.18],
              source: "examples/visionos-sweep/assets/shiba.glb",
              format: "glb",
            },
          ],
          interactions: [{ nodeId: NODE, interactable: true, manipulation: true, events: ["hover", "select", "drag"] }],
        })
      );
      await settle(300);

      const interactor = new PhaseInteractor();
      const model = findInteractableByName("viro-interactable:" + NODE);
      expect(model).toBeTruthy();

      const events = await recordInteractions(NODE, async () => {
        await interactor.hover(model, 300);
        await interactor.trigger(model);
        await interactor.drag(model, new vec3(0.5, 0, 0), 300);
        await sleep(100);

        await interactor.enter(model);
        interactor.startSelecting();
        await frames(5);
        interactor.aimAway();
        await frames(5);
        interactor.stopSelecting();
        await frames(5);
      });

      const seen = phases(events);
      const missing = ALL_PHASES.filter((phase) => !seen.split(",").includes(phase));
      const sources = Array.from(new Set(events.map((e) => e.source))).join(",");
      print("VIRO_LAB_LEAF interaction_phases phases=" + seen + " sources=" + sources + " missing=" + missing.join(","));
      expect(missing.join(",")).toBe("");
    } finally {
      await restoreGeneratedScene();
    }
  }
}
