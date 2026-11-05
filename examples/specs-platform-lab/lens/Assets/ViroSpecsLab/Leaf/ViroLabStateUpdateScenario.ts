import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import type { ViroSpecsPatchOp } from "../../ViroSpecs/lens/ViroSpecsSceneController";
import type { ViroSpecsDocumentNode } from "../../ViroSpecs/lens/ViroSpecsProtocol";
import {
  contentChildren,
  controllerHost,
  countDescendants,
  document,
  LAB,
  restoreGeneratedScene,
  settle,
  textOf,
  waitForGeneratedScene,
} from "./ViroLabLeafSupport";

const nodes = (label: string): ViroSpecsDocumentNode[] => [
  { id: "state-root", kind: "group", position: [0, 0, -1.5] },
  { id: "state-label", kind: "text", parentId: "state-root", position: [0, 0.25, 0], text: label },
  { id: "state-a", kind: "group", parentId: "state-root", position: [-0.2, 0, 0] },
  { id: "state-b", kind: "group", parentId: "state-root", position: [0.2, 0, 0] },
];

/**
 * viro_lab_state_update: a state change that alters one text node is applied
 * as a single update op. Every node keeps its SceneObject (the controller
 * returns the same reference), no scene root is replaced, and the object count
 * under the generated-content root is unchanged.
 */
@component
export class ViroLabStateUpdateScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();
    try {
      host.present(document({ nodes: nodes("count: 0") }));
      await settle();
      const ids = ["state-root", "state-label", "state-a", "state-b"];
      const before = ids.map((id) => host.getNode(id));
      before.forEach((object) => expect(object).toBeTruthy());
      const sceneRootsBefore = contentChildren("viro-scene:").map((o) => o.name).join(",");
      const content = findSceneObjectByName(LAB.generatedContent);
      const countBefore = countDescendants(content);

      const result = host.update(document({ nodes: nodes("count: 1") }));
      await settle();

      expect(result.status).toBe("patched");
      const ops = ((result as { ops?: readonly ViroSpecsPatchOp[] }).ops ?? []) as readonly ViroSpecsPatchOp[];
      expect(ops.length).toBe(1);
      const op = ops[0] as { op: string; node?: { id: string } };
      expect(op.op).toBe("update");
      expect(op.node?.id).toBe("state-label");

      ids.forEach((id, index) => expect(host.getNode(id) === before[index]).toBe(true));
      expect(textOf("viro:state-label")).toBe("count: 1");
      expect(contentChildren("viro-scene:").map((o) => o.name).join(",")).toBe(sceneRootsBefore);
      expect(countDescendants(content)).toBe(countBefore);
      print("VIRO_LAB_LEAF state_update PASS ops=" + JSON.stringify(ops.map((o) => o.op)) + " objects=" + countBefore);
    } finally {
      await restoreGeneratedScene();
    }
  }
}
