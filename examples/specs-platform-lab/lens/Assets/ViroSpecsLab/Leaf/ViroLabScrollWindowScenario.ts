import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import type { ViroSpecsDocumentNode } from "../../ViroSpecs/lens/ViroSpecsProtocol";
import { controllerHost, document, restoreGeneratedScene, settle, waitForGeneratedScene } from "./ViroLabLeafSupport";

/**
 * viro_lab_scroll_window: a scroll group stages under the disabled staging
 * root without a VS5005 (ScrollWindow.initialize() creates an Interactable
 * whose onAwake has not run there), commits, and scrolls when SIK drags it.
 */
@component
export class ViroLabScrollWindowScenario extends Scenario {
  async run(): Promise<void> {
    await waitForGeneratedScene();
    const host = controllerHost();
    try {
      const rows: ViroSpecsDocumentNode[] = [];
      for (let i = 0; i < 8; i++) {
        rows.push({ id: `scroll-row-${i}`, kind: "text", parentId: "scroll-list", position: [0, -0.04 - i * 0.07, 0], text: `Row ${i + 1}` });
      }
      const result = host.present(
        document({
          nodes: [
            { id: "scroll-root", kind: "group", position: [0, 0, -1] },
            { id: "scroll-list", kind: "group", parentId: "scroll-root", scroll: { width: 0.3, height: 0.2, contentHeight: 0.6 } },
            ...rows,
          ],
        })
      );
      await settle(300);

      const codes = host.recentDiagnostics.map((d) => d.code + ":" + d.message);
      print("VIRO_LAB_LEAF scroll_window status=" + result.status + " diagnostics=" + JSON.stringify(codes));
      expect(result.status).toBe("committed");
      expect(codes.some((c) => c.startsWith("VS5005"))).toBe(false);

      const scrollObject = findSceneObjectByName("viro-scroll:scroll-list");
      expect(scrollObject).toBeTruthy();
      const scroll = scrollObject.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null;
      expect(scroll).toBeTruthy();
      const interactable = scrollObject.getComponent(Interactable.getTypeName()) as Interactable | null;
      expect(interactable).toBeTruthy();
      expect(findSceneObjectByName("viro:scroll-row-0")).toBeTruthy();

      // Control: the same ScrollWindow calls the backend makes, but on an
      // object that is already enabled, so onAwake runs before initialize().
      const control = global.scene.createSceneObject("scroll-control");
      control.getTransform().setWorldPosition(new vec3(40, 0, -100));
      const controlScroll = control.createComponent(ScrollWindow.getTypeName()) as ScrollWindow;
      controlScroll.vertical = true;
      controlScroll.horizontal = false;
      controlScroll.initialize();
      controlScroll.windowSize = new vec2(30, 20);
      controlScroll.scrollDimensions = new vec2(30, 60);
      await sleep(300);
      const controlInteractable = control.getComponent(Interactable.getTypeName()) as Interactable | null;

      const drag = async (target: Interactable, window: ScrollWindow): Promise<number> => {
        const before = window.scrollPosition.y;
        // Drag up to scroll the content; LEAF adds the vector each drag frame.
        await new DefaultLeafInteractor().drag(target, new vec3(0, 1, 0), 500);
        await sleep(300);
        return window.scrollPosition.y - before;
      };
      const controlMoved = controlInteractable ? await drag(controlInteractable, controlScroll) : NaN;
      const stagedMoved = await drag(interactable, scroll);
      control.destroy();
      print("VIRO_LAB_LEAF scroll_window moved staged=" + stagedMoved + " control=" + controlMoved);
      // If the control does not scroll either, the drag method is at fault, not staging.
      expect(Math.abs(controlMoved)).toBeGreaterThan(0.5);
      expect(Math.abs(stagedMoved)).toBeGreaterThan(0.5);
      print("VIRO_LAB_LEAF scroll_window PASS");
    } finally {
      await restoreGeneratedScene();
    }
  }
}
