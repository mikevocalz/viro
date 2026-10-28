import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { expectNear, LAB, textOf, waitForGeneratedScene } from "./ViroLabLeafSupport";

/** viro_lab_render: the generated host materialized the compiled scene. */
@component
export class ViroLabRenderScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();

    const root = findSceneObjectByName(LAB.root);
    const title = findSceneObjectByName(LAB.title);
    const model = findSceneObjectByName(LAB.model);
    expect(root).toBeTruthy();
    expect(title).toBeTruthy();
    expect(model).toBeTruthy();

    // -1.5 m in the portable scene becomes -150 cm in Lens.
    expectNear(root.getTransform().getWorldPosition(), LAB.rootWorldCm, 0.5);
    expect(textOf(LAB.title)).toBe(LAB.titleText);

    // The model node holds the instantiated registry prefab.
    expect(model.getChildrenCount()).toBeGreaterThan(0);
    print("VIRO_LAB_LEAF render PASS title=" + textOf(LAB.title));
  }
}
