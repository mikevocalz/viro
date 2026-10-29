/**
 * @jest-environment jsdom
 *
 * The WASM renderer draws the gaze reticle at canvas centre. On web the user
 * aims with the pointer, so the navigators hide it unless `showReticle` asks
 * for it. The switch is the renderer's viroSetReticleVisible export; a WASM
 * built before that export existed must still load.
 */
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

type FakeRenderer = ReturnType<typeof mockMakeRenderer>;

const mockCreated: FakeRenderer[] = [];
let mockWithReticleExport = true;

function mockMakeRenderer(canvas: HTMLCanvasElement) {
  let next = 2;
  const scene = new Proxy({ getRootNode: () => 1 } as Record<string, unknown>, {
    get(target, name: string | symbol) {
      if (typeof name !== "string") return undefined;
      if (name in target) return target[name];
      if (name.startsWith("create")) return () => next++;
      return () => 0;
    },
  });
  const wasmModule: Record<string, unknown> = { pauseMainLoop: jest.fn() };
  const viroSetReticleVisible = jest.fn();
  if (mockWithReticleExport) wasmModule.viroSetReticleVisible = viroSetReticleVisible;
  return {
    scene,
    canvasElement: canvas,
    canvasSize: { width: 1, height: 1 },
    wasmModule,
    viroSetReticleVisible,
    dispose: jest.fn(),
    resize: jest.fn(),
    setNodeEventHandlers: jest.fn(),
    clearNodeEventHandlers: jest.fn(),
    setNodeAnimationHandlers: jest.fn(),
    clearNodeAnimationHandlers: jest.fn(),
    addAbortListener: jest.fn(() => () => {}),
  };
}

// The navigators send a usage ping on mount. Its native-side reader imports
// react-native, which this jsdom suite does not load, and the ping is not under
// test here.
jest.mock("../components/Utilities/ViroUsagePing", () => ({
  useViroUsagePing: () => {},
}));

jest.mock("@reactvision/viro-web-renderer", () => {
  const actual = jest.requireActual("@reactvision/viro-web-renderer");
  return {
    ...actual,
    ViroWebRenderer: {
      create: jest.fn(async ({ canvas }: { canvas: HTMLCanvasElement }) => {
        const r = mockMakeRenderer(canvas);
        mockCreated.push(r);
        return r;
      }),
    },
  };
});

import { Viro3DSceneNavigator } from "../components/Viro3DSceneNavigator.web";
import { ViroSceneNavigator } from "../components/ViroSceneNavigator.web";
import { ViroARSceneNavigator } from "../components/AR/ViroARSceneNavigator.web";
import { ViroScene } from "../components/ViroScene.web";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

function Scene() {
  return <ViroScene />;
}

const NAVIGATORS: Array<[string, React.ComponentType<any>]> = [
  ["Viro3DSceneNavigator", Viro3DSceneNavigator],
  ["ViroSceneNavigator", ViroSceneNavigator],
  ["ViroARSceneNavigator", ViroARSceneNavigator],
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockCreated.length = 0;
  mockWithReticleExport = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

describe.each(NAVIGATORS)("%s reticle", (_name, Navigator) => {
  it("hides the reticle by default", async () => {
    await act(async () => {
      root.render(<Navigator initialScene={{ scene: Scene }} />);
    });
    await settle();
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].viroSetReticleVisible.mock.calls).toEqual([[false]]);
  });

  it("shows it when showReticle is set, and follows the prop", async () => {
    await act(async () => {
      root.render(<Navigator initialScene={{ scene: Scene }} showReticle />);
    });
    await settle();
    const fn = mockCreated[0].viroSetReticleVisible;
    expect(fn).toHaveBeenLastCalledWith(true);

    await act(async () => {
      root.render(<Navigator initialScene={{ scene: Scene }} showReticle={false} />);
    });
    await settle();
    expect(fn).toHaveBeenLastCalledWith(false);
  });

  it("still mounts against a WASM without viroSetReticleVisible", async () => {
    mockWithReticleExport = false;
    await act(async () => {
      root.render(<Navigator initialScene={{ scene: Scene }} />);
    });
    await settle();
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].wasmModule.viroSetReticleVisible).toBeUndefined();
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});

describe("vendored renderer", () => {
  it("exports viroSetReticleVisible", () => {
    const fs = jest.requireActual("fs") as typeof import("fs");
    const path = jest.requireActual("path") as typeof import("path");
    const wasm = fs.readFileSync(path.join(__dirname, "../web/renderer/viro-web.wasm"));
    // embind registers each function under its name, stored as a plain string.
    expect(wasm.includes(Buffer.from("viroSetReticleVisible"))).toBe(true);
  });
});
