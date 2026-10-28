import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { LAB, dragFrames, phases, recordInteractions, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_drag: SIK manipulation on the model (compiled from its onDrag)
 * moves the node and emits portable drag events. Uses deltas, not absolute
 * positions, because scenarios share one live Lens.
 */
@component
export class ViroLabDragScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const interactor = new DefaultLeafInteractor();
    const model = findInteractableByName(LAB.modelInteractable);
    expect(model).toBeTruthy();
    const node = findSceneObjectByName(LAB.model);
    const before = node.getTransform().getWorldPosition();

    // 1 cm on each of 15 drag updates, counted rather than timed so a slow
    // Preview frame rate cannot shorten the drag (dragFrames).
    let frames = 0;
    const events = await recordInteractions(LAB.modelId, async () => {
      frames = await dragFrames(interactor, model, new vec3(1, 0, 0), 15);
      await sleep(50);
    });

    const after = node.getTransform().getWorldPosition();
    const moved = after.x - before.x;
    print("VIRO_LAB_LEAF drag frames=" + frames + " dragEvents=" + phases(events).split(",").filter((p) => p === "drag").length + " movedCm=" + moved.toFixed(3));
    expect(frames).toBeGreaterThan(14);
    expect(moved).toBeGreaterThan(3);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    expect(Math.abs(after.z - before.z)).toBeLessThan(2);
    expect(phases(events).includes("drag")).toBe(true);
    print("VIRO_LAB_LEAF drag PASS movedCm=" + moved.toFixed(2) + " phases=" + phases(events));
  }
}
