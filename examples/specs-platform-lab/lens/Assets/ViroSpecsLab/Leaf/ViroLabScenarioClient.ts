import { DefaultScenarioManager } from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";

/**
 * Runs the generated-lab LEAF scenarios in Preview without the LEAF panel.
 *
 * LEAF documents this ScenarioClient pattern for local auto-run. It is the
 * fallback runner when the [ChatTool] LEAF Plugin's MCP tools are missing.
 * scripts/specs-lens-setup.mjs enables the object holding this component only
 * for its `leaf` step and reads the result lines back with
 * RunAndCollectLogsTool. Leave the object disabled otherwise.
 *
 * Each scenario prints one line:
 *   VIRO_LAB_LEAF_RESULT {"id":"viro_lab_render","status":"succeeded"}
 * and the run ends with VIRO_LAB_LEAF_DONE.
 */
@component
export class ViroLabScenarioClient extends BaseScriptComponent {
  @input
  scenarioIds: string[] = [
    "viro_lab_render",
    "viro_lab_select",
    "viro_lab_drag",
    "viro_lab_navigate",
    "viro_lab_deliberate_failure",
  ];

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.runAll().catch((error) => print("VIRO_LAB_LEAF_DONE error=" + error));
    });
  }

  private async runAll(): Promise<void> {
    const manager = DefaultScenarioManager.getInstance();
    const registered = manager.listScenarioIds();
    // Give the generated host time to apply the scene and SIK to register.
    await sleep(1500);
    for (const id of this.scenarioIds) {
      if (!registered.includes(id)) {
        print("VIRO_LAB_LEAF_RESULT " + JSON.stringify({ id, status: "not-registered" }));
        continue;
      }
      try {
        await manager.startScenario(id);
        print("VIRO_LAB_LEAF_RESULT " + JSON.stringify({ id, status: "succeeded" }));
      } catch (error) {
        print("VIRO_LAB_LEAF_RESULT " + JSON.stringify({ id, status: "failed", error: String(error) }));
      }
      await sleep(500);
    }
    print("VIRO_LAB_LEAF_DONE");
  }
}
