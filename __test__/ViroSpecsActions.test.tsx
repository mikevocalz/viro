import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createStore } from "zustand";

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "android", constants: {} },
  Image: { resolveAssetSource: (source: unknown) => source },
  findNodeHandle: () => null,
  processColor: (value: unknown) => value,
  requireNativeComponent: () => () => null,
}));

import {
  SPECS_ACTIONS_LAB_ACTIONS,
  SPECS_ACTIONS_LAB_REDUCERS,
  SpecsActionsLab,
  createSpecsActionsLabStore,
} from "../examples/specs-platform-lab/SpecsActionsLab";
import { ViroSpecsScene, type ViroSpecsSceneTransport } from "../components/Specs/ViroSpecsScene";
import type { ViroSpecsInteractionEvent } from "../components/Specs/ViroSpecsCompiler";
import {
  bindSpecsActionsToStore,
  createSpecsActionDispatcher,
  type ViroSpecsActionEvent,
} from "../components/Specs/ViroSpecsActions";
import { defineSpecsActions, specsTrigger } from "../components/Specs/core/actions";
import type { ViroSpecsDiagnostic } from "../components/Specs/core/diagnostic";
import type { ViroSpecsSceneDocument } from "../components/Specs/core/manifest";
import { validateSpecsManifestV2 } from "../components/Specs/core/validate";
import { ViroNode } from "../components/ViroNode";
import { ViroText } from "../components/ViroText";

type SpecsGlobal = typeof globalThis & { __VIRO_SPECS_BUILD__?: boolean; IS_REACT_ACT_ENVIRONMENT?: boolean };
const specsGlobal = globalThis as SpecsGlobal;

beforeAll(() => {
  specsGlobal.__VIRO_SPECS_BUILD__ = true;
  specsGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  delete specsGlobal.__VIRO_SPECS_BUILD__;
});

/** Records documents and lets a test emit what the Lens would send back. */
function lensTransport(options: { actions: boolean }) {
  const documents: ViroSpecsSceneDocument[] = [];
  const actionListeners = new Set<(event: ViroSpecsActionEvent) => void>();
  const interactionListeners = new Set<(event: ViroSpecsInteractionEvent) => void>();
  const transport: ViroSpecsSceneTransport = {
    applyScene: jest.fn(),
    applySceneDocument: (document) => {
      documents.push(document);
    },
    onInteraction: (listener) => {
      interactionListeners.add(listener);
      return () => interactionListeners.delete(listener);
    },
    ...(options.actions
      ? {
          onAction: (listener: (event: ViroSpecsActionEvent) => void) => {
            actionListeners.add(listener);
            return () => actionListeners.delete(listener);
          },
        }
      : {}),
  };
  return {
    transport,
    documents,
    latest: () => documents[documents.length - 1],
    emitAction: async (event: ViroSpecsActionEvent) => {
      await act(async () => {
        for (const listener of actionListeners) listener(event);
      });
    },
    emitInteraction: async (event: ViroSpecsInteractionEvent) => {
      await act(async () => {
        for (const listener of interactionListeners) listener(event);
      });
    },
  };
}

async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(element);
  });
  if (!renderer) throw new Error("render failed");
  return renderer;
}

const textOf = (document: ViroSpecsSceneDocument | undefined, id: string): string | undefined => {
  const node = document?.nodes.find((n) => n.id === id);
  return node && node.kind === "text" ? node.text : undefined;
};

describe("createSpecsActionDispatcher", () => {
  const actions = defineSpecsActions({
    "item.pick": { payload: { itemId: { type: "string" }, count: { type: "integer", optional: true } } },
    "mode.set": { payload: { mode: { type: "string", enum: ["a", "b"] } } },
    "nav.back": {},
  } as const);

  it("checks every action against its declaration before calling a handler", () => {
    const diagnostics: ViroSpecsDiagnostic[] = [];
    const picked: string[] = [];
    const dispatcher = createSpecsActionDispatcher(
      actions,
      { "item.pick": ({ itemId }) => picked.push(itemId) },
      { onDiagnostic: (d) => diagnostics.push(d) }
    );
    expect(dispatcher.dispatch({ actionId: "item.pick", payload: { itemId: "x", count: 2 } })).toBe(true);
    expect(dispatcher.dispatch({ actionId: "item.drop", payload: {} })).toBe(false);
    expect(dispatcher.dispatch({ actionId: "item.pick", payload: { itemId: 1, count: 1.5 } })).toBe(false);
    expect(dispatcher.dispatch({ actionId: "mode.set", payload: { mode: "c" } })).toBe(false);
    expect(dispatcher.dispatch({ actionId: "nav.back", payload: {} })).toBe(false);
    expect(picked).toEqual(["x"]);
    expect(diagnostics.map((d) => d.code + " " + (d.fieldPath ?? ""))).toEqual([
      "VS1017 ",
      "VS1018 /payload/itemId",
      "VS1018 /payload/count",
      "VS1018 /payload/mode",
      "VS3024 ",
    ]);
  });

  it("specsTrigger builds JSON triggers typed by the action set", () => {
    expect(specsTrigger(actions, "mode.set", { mode: "b" })).toEqual({ on: "select", actionId: "mode.set", payload: { mode: "b" } });
    expect(specsTrigger(actions, "nav.back", {}, "hover-enter")).toEqual({ on: "hover-enter", actionId: "nav.back" });
  });
});

describe("bindSpecsActionsToStore with a Zustand store", () => {
  it("replaces state only when a reducer returns a new object", () => {
    const store = createSpecsActionsLabStore();
    const dispatcher = bindSpecsActionsToStore(store, SPECS_ACTIONS_LAB_ACTIONS, SPECS_ACTIONS_LAB_REDUCERS);
    const seen: string[] = [];
    store.subscribe((s) => seen.push(s.route + ":" + (s.selectedId ?? "-") + ":" + s.units));
    dispatcher.dispatch({ actionId: "nav.back", payload: {} });
    dispatcher.dispatch({ actionId: "exhibit.open", payload: { exhibitId: "orrery" } });
    dispatcher.dispatch({ actionId: "settings.set-units", payload: { units: "imperial" } });
    dispatcher.dispatch({ actionId: "settings.set-units", payload: { units: "imperial" } });
    dispatcher.dispatch({ actionId: "exhibit.open", payload: { exhibitId: "not-an-exhibit" } });
    expect(seen).toEqual(["details:orrery:metric", "details:orrery:imperial"]);
  });

  it("works with any store that has getState and setState(next, true)", () => {
    const store = createStore<{ count: number }>(() => ({ count: 0 }));
    const counter = defineSpecsActions({ "count.add": { payload: { by: { type: "integer" } } } } as const);
    const dispatcher = bindSpecsActionsToStore(store, counter, { "count.add": (s, { by }) => ({ count: s.count + by }) });
    dispatcher.dispatch({ actionId: "count.add", payload: { by: 3 } });
    expect(store.getState().count).toBe(3);
  });
});

describe("reference flow: SpecsActionsLab on a mock Lens transport", () => {
  it("select card -> details -> change setting -> update -> back to the same list", async () => {
    const lens = lensTransport({ actions: true });
    const store = createSpecsActionsLabStore();
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await mount(<SpecsActionsLab transport={lens.transport} store={store} onDiagnostic={(d) => diagnostics.push(d)} />);

    const list = lens.latest();
    expect(list?.route).toBe("list");
    expect(list?.actions?.map((a) => a.id)).toEqual(["exhibit.open", "settings.set-units", "nav.back"]);
    const scroller = list?.nodes.find((n) => n.id === "exhibit-list");
    expect(scroller?.kind === "group" ? scroller.scroll : undefined).toEqual({ width: 0.44, height: 0.28, contentHeight: 0.56 });
    expect(list?.interactions.find((i) => i.nodeId === "card-planetarium")).toEqual({
      nodeId: "card-planetarium",
      interactable: true,
      manipulation: false,
      events: ["select"],
      triggers: [{ on: "select", actionId: "exhibit.open", payload: { exhibitId: "planetarium" } }],
    });

    await lens.emitAction({ actionId: "exhibit.open", payload: { exhibitId: "planetarium" }, nodeId: "card-planetarium", on: "select" });
    expect(store.getState().route).toBe("details");
    expect(lens.latest()?.route).toBe("details");
    expect(textOf(lens.latest(), "details-distance")).toBe("120 m away");

    await lens.emitAction({ actionId: "settings.set-units", payload: { units: "imperial" }, nodeId: "units-toggle", on: "select" });
    const imperial = lens.latest();
    expect(imperial?.route).toBe("details");
    expect(textOf(imperial, "details-distance")).toBe("394 ft away");
    expect(textOf(imperial, "units-toggle")).toBe("Show meters");

    await lens.emitAction({ actionId: "nav.back", payload: {}, nodeId: "back-button", on: "select" });
    const back = lens.latest();
    expect(back?.route).toBe("list");
    // Same IDs and scroll window as the first list, so the Lens controller's
    // route memory restores the scroll position (asserted in viro-external
    // scripts/actions-fixtures.test.mjs with the real controller).
    expect(back?.nodes.map((n) => n.id)).toEqual(list?.nodes.map((n) => n.id));
    expect(back?.nodes.find((n) => n.id === "exhibit-list")).toEqual(scroller);
    const highlighted = back?.nodes.find((n) => n.id === "card-planetarium");
    expect(highlighted?.kind === "text" ? highlighted.style?.color : undefined).toBe("#7aa2ff");
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("an ill-typed action from the transport is dropped with VS1018 and state is unchanged", async () => {
    const lens = lensTransport({ actions: true });
    const store = createSpecsActionsLabStore();
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await mount(<SpecsActionsLab transport={lens.transport} store={store} onDiagnostic={(d) => diagnostics.push(d)} />);
    const before = store.getState();
    await lens.emitAction({ actionId: "settings.set-units", payload: { units: "furlongs" } });
    expect(store.getState()).toBe(before);
    expect(diagnostics.map((d) => d.code)).toEqual(["VS1018"]);
  });

  it("without onAction, triggers resolve from interactions against the scene the transport applied", async () => {
    const lens = lensTransport({ actions: false });
    const store = createSpecsActionsLabStore();
    await mount(<SpecsActionsLab transport={lens.transport} store={store} />);
    await lens.emitInteraction({ source: "hand-right", phase: "hover-enter", targetId: "card-orrery" });
    expect(store.getState().route).toBe("list");
    await lens.emitInteraction({ source: "hand-right", phase: "select-end", targetId: "card-orrery" });
    expect(store.getState().selectedId).toBe("orrery");
    expect(lens.latest()?.route).toBe("details");
    // A late pinch on a list card arrives after details was applied: the
    // card is not in the applied scene, so nothing fires.
    await lens.emitInteraction({ source: "hand-right", phase: "select-end", targetId: "card-tesla-coil" });
    expect(store.getState().selectedId).toBe("orrery");
  });

  it("a closure in specsAction is VS3023 and the scene is not applied", async () => {
    const lens = lensTransport({ actions: true });
    const diagnostics: ViroSpecsDiagnostic[] = [];
    const closure = { actionId: "nav.back", payload: { run: () => undefined } } as unknown as React.ComponentProps<typeof ViroText>["specsAction"];
    await mount(
      <ViroSpecsScene transport={lens.transport} actions={SPECS_ACTIONS_LAB_ACTIONS.declarations} onDiagnostic={(d) => diagnostics.push(d)}>
        <ViroNode viroTag="root" position={[0, 0, -1.2]}>
          <ViroText viroTag="t" text="x" style={{ fontSize: 120 }} specsAction={closure} />
        </ViroNode>
      </ViroSpecsScene>
    );
    expect(diagnostics.map((d) => d.code)).toEqual(["VS3023"]);
    expect(lens.documents).toEqual([]);
  });
});

// Scene documents for viro-external's cross-repo test
// (packages/specs/scripts/fixtures/actions). Regenerate with
// `npm run fixtures:specs-actions` after changing the lab.
describe("SpecsActionsLab fixtures", () => {
  const dir = path.join(__dirname, "fixtures", "specs", "actions");
  const update = process.env.SPECS_UPDATE_FIXTURES === "1";

  it("match what the runtime compiler produces for each step of the flow", async () => {
    const lens = lensTransport({ actions: true });
    const store = createSpecsActionsLabStore();
    await mount(<SpecsActionsLab transport={lens.transport} store={store} />);
    const list = lens.latest();
    await lens.emitAction({ actionId: "exhibit.open", payload: { exhibitId: "planetarium" } });
    const details = lens.latest();
    await lens.emitAction({ actionId: "settings.set-units", payload: { units: "imperial" } });
    const imperial = lens.latest();
    const steps: Record<string, ViroSpecsSceneDocument | undefined> = {
      "list.scene-v2.json": list,
      "details.scene-v2.json": details,
      "details-imperial.scene-v2.json": imperial,
    };
    if (update) fs.mkdirSync(dir, { recursive: true });
    for (const [name, document] of Object.entries(steps)) {
      expect(document).toBeDefined();
      expect(validateSpecsManifestV2(document).ok).toBe(true);
      const text = JSON.stringify(document, null, 2) + "\n";
      const file = path.join(dir, name);
      if (update) fs.writeFileSync(file, text);
      expect([name, fs.readFileSync(file, "utf8")]).toEqual([name, text]);
    }
  });
});
