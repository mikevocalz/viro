import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { controllerHost, document, restoreGeneratedScene, settle, textOf, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_missing_asset: a model whose GLB is not in the asset registry shows
 * a placeholder box and a VS5003 diagnostic. The rest of the scene still
 * renders, the Lens keeps running, and the scene lifecycle is "degraded".
 */
@component
export class ViroLabMissingAssetScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();
    try {
      const result = host.present(
        document({
          nodes: [
            { id: "missing-root", kind: "group", position: [0, 0, -1.5] },
            { id: "missing-label", kind: "text", parentId: "missing-root", position: [0, 0.25, 0], text: "Asset check" },
            {
              id: "missing-model",
              kind: "model",
              parentId: "missing-root",
              position: [-0.2, -0.05, 0],
              scale: [0.18, 0.18, 0.18],
              source: "examples/missing/not-in-registry.glb",
              format: "glb",
            },
          ],
        })
      );
      await settle();

      expect(result.status).toBe("committed");
      const codes = host.recentDiagnostics.filter((d) => d.nodeId === "missing-model").map((d) => d.code);
      expect(codes.includes("VS5003")).toBe(true);
      expect(host.lifecycle).toBe("degraded");

      const placeholder = findSceneObjectByName("viro-placeholder:missing-model");
      expect(placeholder).toBeTruthy();
      expect(placeholder.enabled).toBe(true);
      expect(placeholder.getComponent("Component.RenderMeshVisual")).toBeTruthy();
      // Not a dead lens: the rest of the scene rendered.
      expect(textOf("viro:missing-label")).toBe("Asset check");
      print("VIRO_LAB_LEAF missing_asset PASS codes=" + codes.join(",") + " lifecycle=" + host.lifecycle);
    } finally {
      await restoreGeneratedScene();
    }
  }
}
