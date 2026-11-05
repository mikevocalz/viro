import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { LAB, textOf, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_deliberate_failure: MUST FAIL. It asserts a title the scene does not
 * have, which proves the suite reports a failed assertion instead of passing
 * everything. A run where this scenario succeeds means the harness is broken.
 */
@component
export class ViroLabDeliberateFailureScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    expect(textOf(LAB.title)).toBe("DELIBERATE_FAILURE_EXPECTED");
  }
}
