import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { Interactable } from "../../ViroSpecs/lens/ViroSpecsInteractionKit";
import { controllerHost, pinch, settle, textOf } from "./ViroLabLeafSupport";
import {
  cameraPose,
  controllerOf,
  decorationBacking,
  decorationText,
  diagnosticsDuring,
  hold,
  injectWorldQuery,
  nodeInteractable,
  nodeOf,
  panelAction,
  panelOpen,
  panelText,
  placeInGaze,
  presentGallery,
  sleep,
  startExperience,
  stopExperience,
  viewOf,
  waitFor,
  waitForExperience,
  withSlowAssets,
  panel,
  rayHits,
  rowLines,
} from "./ViroLabExperienceSupport";

/**
 * viro_ws4_hello_error: Hello, error: the model's GLB is not registered. The node shows a
 * placeholder, the host logs VS5003 for platform-lab-model, the error panel
 * reads "Model didn't load" with one action, Retry, and pinching Retry hands
 * the node ID to the retry listener.
 */
@component
export class ViroWs4HelloErrorScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      const retried: string[] = [];
      const subscription = host.addOnRetryListener((ids) => retried.push(...ids));
      const diagnostics = await diagnosticsDuring(async () => {
        const result = presentGallery("hello", (doc) => {
          nodeOf(doc, "platform-lab-model").source = "examples/visionos-sweep/assets/missing.glb";
        });
        expect(result.status).toBe("committed");
        expect(await waitForExperience(host, "error", () => panelOpen("error"), 3000)).toBe(true);
      });
      const lines = diagnostics.map((d) => d.code + " " + (d.nodeId ?? ""));
      print("VIRO_WS4 hello_error diagnostics=" + JSON.stringify(lines));
      expect(lines.includes("VS5003 platform-lab-model")).toBe(true);
      expect(findSceneObjectByName("viro-placeholder:platform-lab-model")).toBeTruthy();
      expect(panelText("error", "title")).toBe("Model didn't load");
      expect(panelText("error", "detail").includes("VS5003 (platform-lab-model)")).toBe(true);
      expect(panelText("error", "label")).toBe("Retry");
      // The rest of the scene still works.
      expect(textOf("viro:platform-lab-title")).toBe("Hello");
      // Rows are sized from the laid-out glyphs: the diagnostic line is one line.
      print("VIRO_WS4 hello_error rows title=" + rowLines("error", "title") + " body=" + rowLines("error", "body") + " detail=" + rowLines("error", "detail"));
      expect(rowLines("error", "detail")).toBe(1);
      expect(rowLines("error", "body")).toBe(2);
      // The open panel stops rays: put Next scene right behind the panel's
      // centre and cast from the wearer's head through it. The first hit is
      // the panel's backing, which carries a listener-free Interactable, so
      // neither SIK (nearest Interactable) nor gaze (nearest collider) reaches
      // the button behind it.
      const head = cameraPose().position;
      const panelCentre = (panel("error") as SceneObject).getTransform().getWorldPosition();
      const next = controllerHost().getNode("hello-next") as SceneObject;
      const nextWas = next.getTransform().getWorldPosition();
      next.getTransform().setWorldPosition(head.add(panelCentre.sub(head).uniformScale(1.05)));
      // Physics sees the moved collider after its next simulation step.
      await settle(300);
      const target = nodeInteractable("hello-next").getSceneObject();
      const hits = await rayHits(head, head.add(target.getTransform().getWorldPosition().sub(head).uniformScale(1.2)));
      const names = hits.map((h) => h.collider.getSceneObject().name + "<" + (h.collider.getSceneObject().getParent()?.name ?? "") + "@" + Math.round(h.distance));
      print("VIRO_WS4 hello_error ray hits=" + JSON.stringify(names));
      expect(hits.length).toBeGreaterThan(1);
      const first = hits[0].collider.getSceneObject();
      expect(first.getParent()?.name).toBe("ViroSpecsExperience-error");
      expect(first.getComponent(Interactable.getTypeName()) !== null).toBe(true);
      expect(names.some((n) => n.startsWith("viro-interactable:hello-next"))).toBe(true);
      next.getTransform().setWorldPosition(nextWas);
      await hold(config, "hello_error");
      await pinch(new DefaultLeafInteractor(), panelAction("error"));
      await settle(300);
      subscription.remove();
      print("VIRO_WS4 hello_error retried=" + JSON.stringify(retried));
      expect(retried.includes("platform-lab-model")).toBe(true);
      print("VIRO_WS4 hello_error PASS");
    } finally {
      await stopExperience();
    }
  }
}
