import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { controllerHost, describeTree, pinch, settle, textOf } from "./ViroLabLeafSupport";
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
} from "./ViroLabExperienceSupport";

/**
 * viro_ws4_hello_ready: Hello, ready: hovering Next scene draws its hover state (backing scaled
 * up, label "Next scene"), a pinch releasing on it commits once and the app
 * navigates to Placement, and a press released outside (cancel) commits
 * nothing. The host draws the ModelViewer parts (no VS5025): Reset model
 * returns a moved and turned model to its authored transform, and
 * `autoRotate` turns it about 18 degrees a second, never under reduced motion.
 */
@component
export class ViroWs4HelloReadyScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      const presented = await diagnosticsDuring(async () => {
        expect(presentGallery("hello").status).toBe("committed");
        expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
        await settle(300);
      });
      expect(viewOf(host).sceneVisible).toBe(true);
      // The host draws every ModelViewer feature: nothing is reported as undrawn.
      expect(presented.filter((d) => d.code === "VS5025").length).toBe(0);
      expect(decorationText("hello-next", "label")?.text).toBe("Next scene");
      print("VIRO_WS4 hello_ready tree:\n" + describeTree(controllerHost().getNode("hello-next")));
      const backing = decorationBacking("hello-next");
      expect(backing).toBeTruthy();
      const restWidth = (backing as RenderMeshVisual).getSceneObject().getTransform().getLocalScale().x;

      const commits: string[] = [];
      const subscription = controllerHost().addOnInteractionListener((event) => {
        if (event.nodeId === "hello-next") commits.push(event.phase + ":" + event.source);
      });
      try {
        // Press then cancel: the button never commits.
        controllerHost().dispatchInteraction({ nodeId: "hello-next", phase: "select-start", source: "hand-right" });
        controllerHost().dispatchInteraction({ nodeId: "hello-next", phase: "cancel", source: "hand-right" });
        await settle(100);
        expect(commits.filter((c) => c.startsWith("select-end")).length).toBe(0);

        const interactor = new DefaultLeafInteractor();
        const next = nodeInteractable("hello-next");
        await interactor.hover(next, 300);
        const hoverWidth = (backing as RenderMeshVisual).getSceneObject().getTransform().getLocalScale().x;
        print("VIRO_WS4 hello_ready hover width " + restWidth + " -> " + hoverWidth);
        expect(hoverWidth).toBeGreaterThan(restWidth);
        await hold(config, "hello_ready_hover");
        await pinch(interactor, next);
        await settle(200);
        print("VIRO_WS4 hello_ready phases=" + commits.join(","));
        expect(commits.filter((c) => c.startsWith("select-end")).length).toBe(1);
      } finally {
        subscription.remove();
      }
      // ModelViewer Reset model: a host-drawn button under the model returns
      // it to the authored transform after the wearer moved and turned it.
      const reset = findSceneObjectByName("ViroSpecsModelReset:platform-lab-model");
      expect(reset).toBeTruthy();
      expect((reset as SceneObject).enabled).toBe(true);
      expect(((reset as SceneObject).children.find((c) => c.name === "label")?.getComponent("Component.Text") as Text | null)?.text).toBe("Reset model");
      const model = (controllerHost().getNode("platform-lab-model") as SceneObject).getTransform();
      const authoredPosition = model.getLocalPosition();
      const authoredRotation = model.getLocalRotation();
      model.setLocalPosition(authoredPosition.add(new vec3(12, 6, -4)));
      model.setLocalRotation(authoredRotation.multiply(quat.angleAxis(Math.PI / 3, vec3.up())));
      await pinch(new DefaultLeafInteractor(), (reset as SceneObject).getComponent(Interactable.getTypeName()) as Interactable);
      await settle(500);
      const backBy = model.getLocalPosition().distance(authoredPosition);
      const turnedBy = (quat.angleBetween(model.getLocalRotation(), authoredRotation) * 180) / Math.PI;
      print("VIRO_WS4 hello_ready reset offset cm=" + backBy + " angle deg=" + turnedBy);
      expect(backBy).toBeLessThan(0.01);
      expect(turnedBy).toBeLessThan(0.1);

      // autoRotate: about 18 degrees a second about the model's up axis, and
      // none under reduced motion.
      expect(presentGallery("hello", (doc) => {
        (nodeOf(doc, "platform-lab-model").component as Record<string, unknown>).autoRotate = true;
      }).status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      await settle(200);
      const spun = (controllerHost().getNode("platform-lab-model") as SceneObject).getTransform();
      const before = spun.getLocalRotation();
      await sleep(1000);
      const turned = (quat.angleBetween(spun.getLocalRotation(), before) * 180) / Math.PI;
      host.setPreferences(false, true);
      await settle(100);
      const still = spun.getLocalRotation();
      await sleep(600);
      const turnedReduced = (quat.angleBetween(spun.getLocalRotation(), still) * 180) / Math.PI;
      host.setPreferences(false, false);
      print("VIRO_WS4 hello_ready autoRotate deg in 1 s=" + turned + " reduced motion deg in 0.6 s=" + turnedReduced);
      expect(turned).toBeGreaterThan(12);
      expect(turned).toBeLessThan(30);
      expect(turnedReduced).toBeLessThan(0.1);

      // The app's onPress: go to the next gallery scene.
      expect(presentGallery("placement").status).toBe("committed");
      expect(await waitFor(() => findSceneObjectByName("viro:placement-title") !== null)).toBe(true);
      expect(textOf("viro:placement-title")).toBe("Placement");
      print("VIRO_WS4 hello_ready PASS");
    } finally {
      await stopExperience();
    }
  }
}
