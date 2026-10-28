import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import type { ViroSpecsSceneDocumentV2 } from "../../ViroSpecs/lens/ViroSpecsProtocol";
import {
  contentChildren,
  controllerHost,
  countDescendants,
  document,
  LAB,
  restoreGeneratedScene,
  settle,
  waitForGeneratedScene,
} from "./ViroLabLeafSupport";

const CYCLES = 20;

function sceneFor(tag: "a" | "b"): ViroSpecsSceneDocumentV2 {
  return document({
    nodes: [
      { id: `${tag}-root`, kind: "group", position: [0, 0, -1.5] },
      { id: `${tag}-label`, kind: "text", parentId: `${tag}-root`, position: [0, 0.25, 0], text: `scene ${tag}` },
    ],
    polylines: [{ id: `${tag}-line`, points: [[-0.1, -0.2, -1.4], [0.1, -0.2, -1.4]], radiusMeters: 0.003 }],
    interactions: [{ nodeId: `${tag}-label`, interactable: true, manipulation: false, events: ["select"] }],
  });
}

/**
 * viro_lab_scene_replacement: presenting a new scene retires the previous one
 * completely. Across 20 alternating commits there is exactly one scene root
 * after each, none of the previous scene's objects (nodes, line, SIK
 * interactable) remain, and the object count under the generated-content root
 * does not grow.
 */
@component
export class ViroLabSceneReplacementScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();
    const content = findSceneObjectByName(LAB.generatedContent);
    const counts: number[] = [];
    try {
      for (let cycle = 0; cycle < CYCLES; cycle++) {
        const tag = cycle % 2 === 0 ? "a" : "b";
        const previous = tag === "a" ? "b" : "a";
        const result = host.present(sceneFor(tag));
        await settle(150);
        expect(result.status).toBe("committed");

        expect(contentChildren("viro-scene:").length).toBe(1);
        // An interactable text node is its own SIK target, and binding renames
        // it to viro-interactable:<id>; the controller still returns it by id.
        expect(host.getNode(`${tag}-label`)).toBeTruthy();
        expect(findSceneObjectByName(`viro-interactable:${tag}-label`)).toBeTruthy();
        if (cycle > 0) {
          expect(findSceneObjectByName(`viro:${previous}-root`)).toBeNull();
          expect(findSceneObjectByName(`viro:${previous}-label`)).toBeNull();
          expect(findSceneObjectByName(`viro-line:${previous}-line`)).toBeNull();
          expect(findSceneObjectByName(`viro-interactable:${previous}-label`)).toBeNull();
        }
        counts.push(countDescendants(content));
      }
      // Same scene shape each time, so the count settles and stays flat.
      const steady = counts.slice(2);
      expect(Math.max(...steady) - Math.min(...steady)).toBe(0);
      print("VIRO_LAB_LEAF scene_replacement PASS cycles=" + CYCLES + " objects=" + JSON.stringify(counts));
    } finally {
      await restoreGeneratedScene();
    }
  }
}
