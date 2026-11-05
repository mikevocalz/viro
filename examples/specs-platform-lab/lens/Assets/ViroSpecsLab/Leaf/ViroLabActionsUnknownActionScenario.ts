import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import {
  controllerHost,
  document,
  LAB,
  recordDiagnostics,
  settle,
  startActionsLab,
  stopActionsLab,
  waitForGeneratedScene,
} from "./ViroLabLeafSupport";

/**
 * viro_lab_actions_unknown_action: an action ID nobody declared is rejected
 * with VS5015 on both paths.
 * 1. A scene whose trigger names an undeclared action is rejected before
 *    staging; the fieldPath points at the trigger, and the committed scene
 *    stays on screen.
 * 2. A dispatch of an undeclared action returns false, reports VS5015, and
 *    leaves the app state unchanged.
 */
@component
export class ViroLabActionsUnknownActionScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();

    const result = host.present({
      ...document({
        nodes: [{ id: "pick", kind: "group", position: [0, 0, -1] }],
        interactions: [
          {
            nodeId: "pick",
            interactable: true,
            manipulation: false,
            events: ["select"],
            triggers: [{ on: "select", actionId: "item.drop" }],
          },
        ],
      }),
      actions: [{ id: "item.pick" }],
    });
    await settle();
    const rejected = result;
    print("VIRO_LAB_LEAF actions_unknown_action present=" + rejected.status + " " + JSON.stringify(rejected.diagnostics));
    expect(rejected.status).toBe("rejected");
    expect(rejected.diagnostics.map((d) => d.code).join(",")).toBe("VS5015");
    expect(rejected.diagnostics[0].fieldPath).toBe("/interactions/0/triggers/0/actionId");
    expect(findSceneObjectByName("viro:pick")).toBeFalsy();
    expect(findSceneObjectByName(LAB.root)).toBeTruthy();

    const lab = await startActionsLab();
    try {
      const before = lab.state;
      let accepted = true;
      const diagnostics = await recordDiagnostics(async () => {
        accepted = lab.dispatch("exhibit.teleport", {});
        await settle();
      });
      print("VIRO_LAB_LEAF actions_unknown_action dispatch accepted=" + accepted + " " + JSON.stringify(diagnostics.map((d) => d.code + ":" + d.message)));
      expect(accepted).toBe(false);
      expect(diagnostics.map((d) => d.code).join(",")).toBe("VS5015");
      expect(lab.state === before).toBe(true);
      print("VIRO_LAB_LEAF actions_unknown_action PASS");
    } finally {
      await stopActionsLab();
    }
  }
}
