import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { createIKInteractor } from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { LAB, phases, recordInteractions, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_select_ik: selects the model the way a wearer would, with a full
 * arm and head (LEAF's IK interactor). The model sits 1.5 m away, so the
 * expected path is the far-field ray. If the reach does not converge, LEAF
 * records a diagnostic and this scenario fails; that is a reachability
 * finding about the scene, not a test bug.
 */
@component
export class ViroLabSelectIKScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const ik = createIKInteractor();
    const model = findInteractableByName(LAB.modelInteractable);
    expect(model).toBeTruthy();

    const events = await recordInteractions(LAB.modelId, async () => {
      await ik.trigger(model);
    });

    const seen = phases(events);
    expect(seen.includes("select-start")).toBe(true);
    expect(seen.includes("select-end")).toBe(true);
    print("VIRO_LAB_LEAF select_ik PASS phases=" + seen);
  }
}
