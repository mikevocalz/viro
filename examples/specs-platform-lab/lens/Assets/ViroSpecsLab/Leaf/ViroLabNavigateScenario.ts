import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { expectNear, LAB, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_navigate: the compiled ViroPolyline is presented through
 * ViroSpecsNavigationHost as a VolumetricLine whose control points sit at the
 * route's world positions in centimeters.
 */
@component
export class ViroLabNavigateScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const line = findSceneObjectByName(LAB.line);
    expect(line).toBeTruthy();
    expect(line.getChildrenCount()).toBe(LAB.linePointsWorldCm.length);

    LAB.linePointsWorldCm.forEach((expected, index) => {
      const point = findSceneObjectByName(LAB.linePoint(index));
      expect(point).toBeTruthy();
      expectNear(point.getTransform().getWorldPosition(), expected, 0.5);
    });

    print("VIRO_LAB_LEAF navigate PASS points=" + LAB.linePointsWorldCm.length);
  }
}
