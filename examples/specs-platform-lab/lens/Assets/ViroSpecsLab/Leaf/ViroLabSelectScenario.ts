import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { LAB, phases, recordInteractions, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_select: a SIK trigger on the model (compiled from its onClick)
 * reaches the portable interaction channel as select-start then select-end.
 */
@component
export class ViroLabSelectScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const interactor = new DefaultLeafInteractor();
    const model = findInteractableByName(LAB.modelInteractable);
    expect(model).toBeTruthy();

    const events = await recordInteractions(LAB.modelId, async () => {
      await interactor.hover(model, 100);
      await interactor.trigger(model);
    });

    // The compiled model declares select and drag only (onClick/onDrag), and
    // the scene controller forwards hover phases only for nodes that declare
    // "hover", so this checks the select phases. viro_lab_interaction_phases
    // covers hover.
    const seen = phases(events);
    expect(seen.includes("select-start")).toBe(true);
    expect(seen.includes("select-end")).toBe(true);
    expect(seen.indexOf("select-start") < seen.indexOf("select-end")).toBe(true);
    print("VIRO_LAB_LEAF select PASS phases=" + seen);
  }
}
