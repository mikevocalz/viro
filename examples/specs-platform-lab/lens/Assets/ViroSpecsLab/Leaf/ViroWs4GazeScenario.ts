import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
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
} from "./ViroLabExperienceSupport";

/**
 * viro_ws4_gaze: Interaction, gaze: with hand tracking unavailable the view asks for Move
 * buttons, moveNode steps the model 10 cm to the left, and a dwell on the
 * disabled button never selects it. On Navigation the host draws Scroll up
 * and Scroll down under the list; a dwell on Scroll down moves the list one
 * row (scrollByRows) and a dwell on Scroll up moves it back.
 */
@component
export class ViroWs4GazeScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const host = await startExperience();
    try {
      expect(presentGallery("interaction").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      host.setCapabilities({ "hand-tracking": "temporarily-unavailable" });
      await settle(200);
      const view = viewOf(host);
      expect(view.inputMode).toBe("gaze");
      expect(view.gazeControls.moveButtons).toBe(true);
      const model = controllerHost().getNode("ix-model") as SceneObject;
      const before = model.getTransform().getWorldPosition();
      host.moveNode("ix-model", "left");
      const after = model.getTransform().getWorldPosition();
      print("VIRO_WS4 gaze move x " + before.x + " -> " + after.x);
      expect(Math.abs(before.x - after.x - 10)).toBeLessThan(0.5);

      const doc = controllerHost().committedScene as { nodes: ReadonlyArray<{ id: string; component?: { type: string; state?: string } }> };
      const disabled = doc.nodes.find((n) => n.component?.type === "panel-button" && n.component.state === "disabled");
      expect(disabled).toBeTruthy();
      const id = (disabled as { id: string }).id;
      const events: string[] = [];
      const sub = controllerHost().addOnInteractionListener((event) => {
        if (event.nodeId === id && event.source === "gaze") events.push(event.phase);
      });
      try {
        placeInGaze(id, 1.2);
        let dwellShown = false;
        for (let i = 0; i < 15; i++) {
          if (findSceneObjectByName("ViroSpecsDwell")?.enabled) dwellShown = true;
          await sleep(100);
        }
        print("VIRO_WS4 gaze disabled events=" + events.join(",") + " dwellShown=" + dwellShown);
        expect(events.length).toBe(0);
        expect(dwellShown).toBe(false);
        await hold(config, "interaction_gaze");
      } finally {
        sub.remove();
      }

      // Navigation: gaze Scroll buttons under the list window. "Got it" on
      // the hand-tracking notice first, as the wearer would.
      controllerOf(host).dismissNotice();
      expect(presentGallery("navigation").status).toBe("committed");
      expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      const down = (): SceneObject | null => findSceneObjectByName("ViroSpecsScroll-down:nav-list");
      const up = (): SceneObject | null => findSceneObjectByName("ViroSpecsScroll-up:nav-list");
      expect(await waitFor(() => (down()?.enabled ?? false) && (up()?.enabled ?? false), 2000)).toBe(true);
      await hold(config, "gaze_scroll_buttons");
      const scrollY = (): number => controllerHost().getNodeState("nav-list")?.scrollNormalized?.[1] ?? 1;
      const start = scrollY();
      // Bring a button into the head ray: move the panel so the button's
      // centre sits on the camera's forward line (the buttons follow the list).
      const aim = async (button: SceneObject): Promise<void> => {
        const panelObject = controllerHost().getNode("nav-panel") as SceneObject;
        const pose = cameraPose();
        const at = button.getTransform().getWorldPosition();
        const along = at.sub(pose.position).dot(pose.forward);
        const target = pose.position.add(pose.forward.uniformScale(along));
        const t = panelObject.getTransform();
        t.setWorldPosition(t.getWorldPosition().add(target.sub(at)));
        await settle(100);
      };
      await aim(down() as SceneObject);
      expect(await waitForExperience(host, "scroll down by gaze", () => scrollY() < start - 0.01, 3000)).toBe(true);
      const afterDown = scrollY();
      // Look away (nothing on the head ray) so the dwell can fire again,
      // then dwell on Scroll up.
      const away = (controllerHost().getNode("nav-panel") as SceneObject).getTransform();
      away.setWorldPosition(away.getWorldPosition().add(new vec3(0, -300, 0)));
      await settle(300);
      await aim(up() as SceneObject);
      expect(await waitForExperience(host, "scroll up by gaze", () => scrollY() > afterDown + 0.01, 3000)).toBe(true);
      print("VIRO_WS4 gaze scroll y " + start + " -> " + afterDown + " -> " + scrollY());
      print("VIRO_WS4 gaze PASS");
    } finally {
      await stopExperience();
    }
  }
}
